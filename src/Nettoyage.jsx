import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import db from "./firebase";
import * as XLSX from "xlsx";

/* =========================================================
   NORMALISATION
========================================================= */

const normaliserTexte = (texte) => {
  return (texte || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-'’._]/g, "");
};

const normaliserTelephone = (tel) => {
  let chiffres = (tel || "").toString().replace(/\D/g, "");
  if (chiffres.startsWith("00225")) chiffres = chiffres.slice(5);
  else if (chiffres.startsWith("225") && chiffres.length > 10)
    chiffres = chiffres.slice(3);
  return chiffres;
};

// Découpe en mots individuels normalisés
const extraireMots = (nom, prenom) => {
  return `${nom || ""} ${prenom || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-'’._]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length >= 2);
};

// Similarité entre deux mots (Levenshtein simplifié)
const similitudeMots = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const minLen = Math.min(a.length, b.length);
  if (minLen === 0) return 0;

  // Compte les caractères communs dans le bon ordre (simplifié)
  let communs = 0;
  const plusCourt = a.length < b.length ? a : b;
  const plusLong = a.length < b.length ? b : a;

  for (let i = 0; i < plusCourt.length; i++) {
    if (plusCourt[i] === plusLong[i]) communs++;
  }

  return communs / plusLong.length;
};

// Ratio de mots communs entre deux fiches
const ratioMotsCommuns = (motsA, motsB) => {
  if (motsA.length === 0 || motsB.length === 0) return 0;

  let matches = 0;
  const utilises = new Array(motsB.length).fill(false);

  motsA.forEach((ma) => {
    for (let i = 0; i < motsB.length; i++) {
      if (utilises[i]) continue;
      const sim = similitudeMots(ma, motsB[i]);
      if (sim >= 0.75) {
        matches++;
        utilises[i] = true;
        break;
      }
    }
  });

  // Ratio basé sur le plus petit ensemble de mots
  const minMots = Math.min(motsA.length, motsB.length);
  return matches / minMots;
};

// Confiance globale du regroupement entre deux fiches
const calculerConfiance = (a, b) => {
  // 1. Empreinte identique → confiance maximale
  const empA =
    a.empreinte ||
    [normaliserTexte(a.nom), normaliserTexte(a.prenom), normaliserTelephone(a.telephone)].join("|");
  const empB =
    b.empreinte ||
    [normaliserTexte(b.nom), normaliserTexte(b.prenom), normaliserTelephone(b.telephone)].join("|");

  if (empA === empB) return { score: 100, niveau: "FORT", raison: "Empreinte identique" };

  const telA = normaliserTelephone(a.telephone);
  const telB = normaliserTelephone(b.telephone);
  const memeTel = telA && telB && telA === telB && telA.length >= 8;

  const motsA = extraireMots(a.nom, a.prenom);
  const motsB = extraireMots(b.nom, b.prenom);
  const ratio = ratioMotsCommuns(motsA, motsB);

  // Même téléphone + mots très similaires → FORT
  if (memeTel && ratio >= 0.75) {
    return { score: 90, niveau: "FORT", raison: "Téléphone + noms similaires" };
  }

  // Même téléphone + mots moyennement similaires → MOYEN
  if (memeTel && ratio >= 0.5) {
    return { score: 60, niveau: "MOYEN", raison: "Téléphone identique, noms proches" };
  }

  // Même téléphone mais mots peu similaires → FAIBLE
  if (memeTel && ratio < 0.5) {
    return { score: 20, niveau: "FAIBLE", raison: "Téléphone identique, noms différents" };
  }

  // Pas le même téléphone mais noms très similaires
  if (ratio >= 0.75) {
    return { score: 70, niveau: "MOYEN", raison: "Noms très similaires" };
  }

  return { score: 0, niveau: "AUCUNE", raison: "Aucun critère commun" };
};

// Niveau de confiance global d'un groupe
const niveauGroupe = (fiches) => {
  let minScore = 100;
  for (let i = 0; i < fiches.length; i++) {
    for (let j = i + 1; j < fiches.length; j++) {
      const c = calculerConfiance(fiches[i], fiches[j]);
      if (c.score < minScore) minScore = c.score;
    }
  }
  if (minScore >= 85) return { niveau: "FORT", couleur: "#76ee59" };
  if (minScore >= 55) return { niveau: "MOYEN", couleur: "#feca57" };
  return { niveau: "FAIBLE", couleur: "#ff6b6b" };
};

const CHAMPS_FUSIONNABLES = [
  { key: "nom", label: "Nom" },
  { key: "prenom", label: "Prénom" },
  { key: "telephone", label: "Téléphone" },
  { key: "departement", label: "Département" },
  { key: "statut", label: "Statut" },
  { key: "empreinte", label: "Empreinte" },
];

/* =========================================================
   COMPOSANT
========================================================= */

function Nettoyage() {
  const [chargement, setChargement] = useState(true);
  const [personnes, setPersonnes] = useState([]);
  const [presences, setPresences] = useState([]);
  const [traitementEnCours, setTraitementEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [editions, setEditions] = useState({});
  const [ignorerGroupes, setIgnorerGroupes] = useState({});

  /* =========================================================
     CHARGEMENT
  ========================================================= */

  const charger = async () => {
    setChargement(true);
    setErreur("");
    try {
      const snapP = await getDocs(collection(db, "personnes"));
      const dataP = snapP.docs
        .filter((d) => d.id !== "_counter")
        .map((d) => ({ id: d.id, ...d.data() }));
      setPersonnes(dataP);

      const snapPr = await getDocs(collection(db, "presences"));
      const dataPr = snapPr.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPresences(dataPr);
    } catch (err) {
      console.error(err);
      setErreur("Erreur de chargement : " + err.message);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  /* =========================================================
     DÉTECTION INTELLIGENTE
  ========================================================= */

  const groupes = useMemo(() => {
    const fiches = personnes.filter(
      (p) => p.personneId && p.personneId !== "BT-TESTA-9999"
    );

    const parents = {};
    fiches.forEach((_, i) => {
      parents[i] = i;
    });

    const trouver = (x) => {
      while (parents[x] !== x) {
        parents[x] = parents[parents[x]];
        x = parents[x];
      }
      return x;
    };

    const unir = (a, b) => {
      const ra = trouver(a);
      const rb = trouver(b);
      if (ra !== rb) parents[ra] = rb;
    };

    // Unir UNIQUEMENT si confiance suffisante
    for (let i = 0; i < fiches.length; i++) {
      for (let j = i + 1; j < fiches.length; j++) {
        const confiance = calculerConfiance(fiches[i], fiches[j]);
        if (confiance.score >= 55) {
          unir(i, j);
        }
      }
    }

    const groupesMap = {};
    fiches.forEach((p, i) => {
      const r = trouver(i);
      if (!groupesMap[r]) groupesMap[r] = [];
      groupesMap[r].push(p);
    });

    const comptePresences = (id) =>
      presences.filter((pr) => pr.personneId === id).length;

    const doublons = Object.values(groupesMap)
      .filter((arr) => arr.length > 1)
      .map((arr) => {
        const tries = [...arr].sort((a, b) => {
          const na = parseInt((a.personneId || "").replace(/\D/g, "")) || 0;
          const nb = parseInt((b.personneId || "").replace(/\D/g, "")) || 0;
          return na - nb;
        });
        const enrichies = tries.map((p) => ({
          ...p,
          nbPresences: comptePresences(p.personneId),
        }));

        return {
          fiches: enrichies,
          confiance: niveauGroupe(enrichies),
        };
      })
      .sort((a, b) => {
        const na =
          parseInt((a.fiches[0].personneId || "").replace(/\D/g, "")) || 0;
        const nb =
          parseInt((b.fiches[0].personneId || "").replace(/\D/g, "")) || 0;
        return na - nb;
      });

    return doublons;
  }, [personnes, presences]);

  /* =========================================================
     STATS GLOBALES
  ========================================================= */

  const totalFiches = personnes.filter(
    (p) => p.personneId && p.personneId !== "BT-TESTA-9999"
  ).length;

  const totalGroupes = groupes.length;

  const totalFichesDoublons = groupes.reduce(
    (s, g) => s + (g.fiches.length - 1),
    0
  );

  const totalFichesUniques = totalFiches - totalFichesDoublons;

  const totalPresencesImpactees = groupes.reduce(
    (s, g) =>
      s +
      g.fiches
        .slice(1)
        .reduce((ss, p) => ss + (p.nbPresences || 0), 0),
    0
  );

  const fichesSelectionnees = Object.values(editions).reduce(
    (s, e) => s + Object.values(e.selection).filter(Boolean).length,
    0
  );

  const fichesApresFusion = totalFiches - fichesSelectionnees;

  /* =========================================================
     INITIALISATION DES ÉDITIONS
  ========================================================= */

  useEffect(() => {
    const nouv = {};
    groupes.forEach((g, idx) => {
      const garde = g.fiches[0].id;
      const selection = {};
      const recuperations = {};

      g.fiches.forEach((p, i) => {
        if (i > 0) {
          selection[p.id] = false; // DÉSACTIVÉ PAR DÉFAUT pour éviter les erreurs
          recuperations[p.id] = {};
          CHAMPS_FUSIONNABLES.forEach((c) => {
            recuperations[p.id][c.key] = false;
          });
        }
      });

      nouv[idx] = { garde, selection, recuperations };
    });
    setEditions(nouv);
  }, [groupes]);

  /* =========================================================
     HANDLERS
  ========================================================= */

  const toggleSelection = (idxGroupe, idFirestore) => {
    setEditions((prev) => {
      const e = { ...prev[idxGroupe] };
      const sel = { ...e.selection };
      sel[idFirestore] = !sel[idFirestore];
      e.selection = sel;
      return { ...prev, [idxGroupe]: e };
    });
  };

  const changerGarde = (idxGroupe, idFirestore) => {
    setEditions((prev) => {
      const e = { ...prev[idxGroupe] };
      e.garde = idFirestore;
      const sel = { ...e.selection };
      delete sel[idFirestore];
      e.selection = sel;
      return { ...prev, [idxGroupe]: e };
    });
  };

  const toggleRecuperation = (idxGroupe, idFirestore, champ) => {
    setEditions((prev) => {
      const e = { ...prev[idxGroupe] };
      const rec = { ...e.recuperations };
      const recFiche = { ...(rec[idFirestore] || {}) };
      recFiche[champ] = !recFiche[champ];
      rec[idFirestore] = recFiche;
      e.recuperations = rec;
      return { ...prev, [idxGroupe]: e };
    });
  };

  const toggleIgnorer = (idxGroupe) => {
    setIgnorerGroupes((prev) => ({
      ...prev,
      [idxGroupe]: !prev[idxGroupe],
    }));
  };

  const calculerApercu = (idxGroupe) => {
    const g = groupes[idxGroupe];
    const edit = editions[idxGroupe];
    if (!edit) return null;

    const garde = g.fiches.find((p) => p.id === edit.garde);
    if (!garde) return null;

    const resultat = {
      nom: garde.nom || "",
      prenom: garde.prenom || "",
      telephone: garde.telephone || "",
      departement: garde.departement || "",
      statut: garde.statut || "",
      empreinte: garde.empreinte || "",
    };

    const fichesFusionnees = g.fiches.filter(
      (p) => edit.selection[p.id] && p.id !== edit.garde
    );

    fichesFusionnees.forEach((p) => {
      const rec = edit.recuperations[p.id] || {};
      CHAMPS_FUSIONNABLES.forEach((c) => {
        if (rec[c.key] && p[c.key]) {
          resultat[c.key] = p[c.key];
        }
      });
    });

    return resultat;
  };

  /* =========================================================
     FUSIONNER UN GROUPE
  ========================================================= */

  const fusionnerGroupeSelonChoix = async (idxGroupe) => {
    const g = groupes[idxGroupe];
    const edit = editions[idxGroupe];
    if (!edit) return;

    if (ignorerGroupes[idxGroupe]) {
      alert("Ce groupe est marqué 'IGNORÉ'. Décoche d'abord Ignorer.");
      return;
    }

    const ficheGarde = g.fiches.find((p) => p.id === edit.garde);
    if (!ficheGarde) {
      alert("Aucune fiche à garder.");
      return;
    }

    const fichesAFusionner = g.fiches.filter(
      (p) => edit.selection[p.id] && p.id !== edit.garde
    );

    if (fichesAFusionner.length === 0) {
      alert("Aucune fiche à fusionner.");
      return;
    }

    const apercu = calculerApercu(idxGroupe);
    const resume = fichesAFusionner
      .map((p) => `${p.personneId} (${p.nom} ${p.prenom})`)
      .join(", ");

    const confirmer = window.confirm(
      `Fusionner : ${resume}\n\n` +
        `Vers : ${ficheGarde.personneId}\n\n` +
        `Fiche finale :\n` +
        `- Nom : ${apercu.nom}\n` +
        `- Prénom : ${apercu.prenom}\n` +
        `- Téléphone : ${apercu.telephone}\n` +
        `- Département : ${apercu.departement || "(vide)"}\n` +
        `- Statut : ${apercu.statut}\n\n` +
        `Continuer ?`
    );

    if (!confirmer) return;

    setTraitementEnCours(true);
    try {
      const idGarde = ficheGarde.personneId;
      const idsSupprimes = fichesAFusionner.map((p) => p.personneId);

      const updates = {
        nom: apercu.nom,
        prenom: apercu.prenom,
        telephone: apercu.telephone,
        departement: apercu.departement,
        statut: apercu.statut,
        empreinte: apercu.empreinte,
      };
      Object.keys(updates).forEach((k) => {
        if (updates[k] === undefined) delete updates[k];
      });

      await updateDoc(doc(db, "personnes", ficheGarde.id), updates);

      for (const presence of presences) {
        if (idsSupprimes.includes(presence.personneId)) {
          await updateDoc(doc(db, "presences", presence.id), {
            personneId: idGarde,
            nom: apercu.nom,
            prenom: apercu.prenom,
            telephone: apercu.telephone,
            departement: apercu.departement,
            statut: apercu.statut,
          });
        }
      }

      for (const p of fichesAFusionner) {
        await deleteDoc(doc(db, "personnes", p.id));
      }

      alert("Fusion réussie.");
      await charger();
    } catch (err) {
      console.error(err);
      alert("Erreur : " + err.message);
    } finally {
      setTraitementEnCours(false);
    }
  };

  /* =========================================================
     TOUT FUSIONNER
  ========================================================= */

  const toutFusionner = async () => {
    if (groupes.length === 0) {
      alert("Aucun doublon à fusionner.");
      return;
    }

    const confirmer = window.confirm(
      `ATTENTION : cette action va fusionner tous les groupes NON IGNORÉS.\n\n` +
        `- ${fichesSelectionnees} fiche(s) seront supprimées\n` +
        `- ${totalPresencesImpactees} présence(s) seront réaffectées\n\n` +
        `Continuer ?`
    );

    if (!confirmer) return;

    setTraitementEnCours(true);
    try {
      for (let idx = 0; idx < groupes.length; idx++) {
        if (ignorerGroupes[idx]) continue;
        const edit = editions[idx];
        if (!edit) continue;

        const g = groupes[idx];
        const ficheGarde = g.fiches.find((p) => p.id === edit.garde);
        if (!ficheGarde) continue;

        const fichesAFusionner = g.fiches.filter(
          (p) => edit.selection[p.id] && p.id !== edit.garde
        );
        if (fichesAFusionner.length === 0) continue;

        const apercu = calculerApercu(idx);
        const idGarde = ficheGarde.personneId;
        const idsSupprimes = fichesAFusionner.map((p) => p.personneId);

        const updates = {
          nom: apercu.nom,
          prenom: apercu.prenom,
          telephone: apercu.telephone,
          departement: apercu.departement,
          statut: apercu.statut,
          empreinte: apercu.empreinte,
        };
        Object.keys(updates).forEach((k) => {
          if (updates[k] === undefined) delete updates[k];
        });

        await updateDoc(doc(db, "personnes", ficheGarde.id), updates);

        for (const presence of presences) {
          if (idsSupprimes.includes(presence.personneId)) {
            await updateDoc(doc(db, "presences", presence.id), {
              personneId: idGarde,
              nom: apercu.nom,
              prenom: apercu.prenom,
              telephone: apercu.telephone,
              departement: apercu.departement,
              statut: apercu.statut,
            });
          }
        }

        for (const p of fichesAFusionner) {
          await deleteDoc(doc(db, "personnes", p.id));
        }
      }

      alert("Toutes les fusions ont été effectuées.");
      await charger();
    } catch (err) {
      console.error(err);
      alert("Erreur : " + err.message);
    } finally {
      setTraitementEnCours(false);
    }
  };

  /* =========================================================
     EXPORT SAUVEGARDE
  ========================================================= */

  const exporterSauvegarde = () => {
    const wb = XLSX.utils.book_new();
    const wsP = XLSX.utils.json_to_sheet(
      personnes.map((p) => ({
        id: p.id,
        personneId: p.personneId,
        nom: p.nom,
        prenom: p.prenom,
        telephone: p.telephone,
        empreinte: p.empreinte,
        statut: p.statut,
        departement: p.departement,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsP, "personnes");

    const wsPr = XLSX.utils.json_to_sheet(
      presences.map((p) => ({
        id: p.id,
        personneId: p.personneId,
        nom: p.nom,
        prenom: p.prenom,
        date: p.date,
        heure: p.heure,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsPr, "presences");

    XLSX.writeFile(
      wb,
      `BLOOM_SAUVEGARDE_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  /* =========================================================
     RENDU
  ========================================================= */

  if (chargement) {
    return (
      <div className="nettoyage-chargement">Chargement des données...</div>
    );
  }

  return (
    <div className="nettoyage-page">
      <div className="nettoyage-entete">
        <div>
          <p className="admin-sur-titre">MAINTENANCE</p>
          <h2>FUSION MANUELLE DES DOUBLONS</h2>
          <p>
            Détection intelligente : les noms différents sur le même téléphone
            ne sont plus regroupés. Vérifie chaque groupe avant de fusionner.
          </p>
        </div>
        <button
          className="bouton-actualiser"
          onClick={charger}
          disabled={traitementEnCours}
        >
          RELANCER LA DÉTECTION
        </button>
      </div>

      {erreur && <div className="admin-erreur">{erreur}</div>}

      <div className="nettoyage-avertissement">
        <strong>AVERTISSEMENT</strong>
        <p>Sauvegarde d'abord la base en cliquant sur SAUVEGARDER.</p>
        <button
          className="bouton-export-mini"
          onClick={exporterSauvegarde}
          disabled={traitementEnCours}
        >
          SAUVEGARDER TOUTE LA BASE
        </button>
      </div>

      {/* STATS */}
      <div className="nettoyage-stats">
        <div className="carte-nettoyage">
          <p>FICHES TOTALES</p>
          <strong>{totalFiches}</strong>
        </div>
        <div className="carte-nettoyage">
          <p>GROUPES DE DOUBLONS</p>
          <strong>{totalGroupes}</strong>
        </div>
        <div className="carte-nettoyage">
          <p>FICHES À SUPPRIMER</p>
          <strong>{totalFichesDoublons}</strong>
        </div>
        <div className="carte-nettoyage">
          <p>PRÉSENCES À RÉAFFECTER</p>
          <strong>{totalPresencesImpactees}</strong>
        </div>
        <div className="carte-nettoyage carte-nettoyage-final">
          <p>APRÈS NETTOYAGE (estimé)</p>
          <strong>{totalFichesUniques} fiches</strong>
        </div>
      </div>

      {totalGroupes > 0 && (
        <div className="nettoyage-stats nettoyage-stats-selection">
          <div className="carte-nettoyage">
            <p>FICHES SÉLECTIONNÉES</p>
            <strong>{fichesSelectionnees}</strong>
          </div>
          <div className="carte-nettoyage carte-nettoyage-final">
            <p>APRÈS FUSION SÉLECTION</p>
            <strong>{fichesApresFusion} fiches</strong>
          </div>
        </div>
      )}

      {totalGroupes > 0 && (
        <div className="nettoyage-actions-globales">
          <button
            className="bouton-fusionner-tout"
            onClick={toutFusionner}
            disabled={traitementEnCours || fichesSelectionnees === 0}
          >
            TOUT FUSIONNER SELON SÉLECTIONS ({totalGroupes} groupe(s))
          </button>
        </div>
      )}

      {groupes.length === 0 && (
        <div className="nettoyage-vide">
          <strong>AUCUN DOUBLON DÉTECTÉ</strong>
          <p>Votre base est propre.</p>
        </div>
      )}

      {groupes.length > 0 && (
        <div className="nettoyage-liste">
          <h3>GROUPES DE DOUBLONS DÉTECTÉS</h3>

          {groupes.map((g, idx) => {
            const edit = editions[idx] || {
              garde: null,
              selection: {},
              recuperations: {},
            };
            const nbSelection = Object.values(edit.selection).filter(
              Boolean
            ).length;
            const apercu = calculerApercu(idx);
            const ignore = ignorerGroupes[idx];

            return (
              <div
                key={idx}
                className={`groupe-doublon ${
                  ignore ? "groupe-ignore" : ""
                }`}
              >
                <div className="groupe-entete">
                  <div>
                    <p className="groupe-numero">
                      GROUPE {idx + 1}
                      <span
                        className="badge-confiance"
                        style={{ background: g.confiance.couleur }}
                      >
                        CONFIANCE {g.confiance.niveau}
                      </span>
                    </p>
                    <h4>
                      {g.fiches.length} fiche(s) — sélection : {nbSelection} à
                      fusionner
                    </h4>
                  </div>
                  <div className="groupe-actions">
                    <button
                      className={`bouton-ignorer ${
                        ignore ? "actif" : ""
                      }`}
                      onClick={() => toggleIgnorer(idx)}
                    >
                      {ignore ? "IGNORÉ" : "IGNORER"}
                    </button>
                    <button
                      className="bouton-fusionner"
                      onClick={() => fusionnerGroupeSelonChoix(idx)}
                      disabled={traitementEnCours || nbSelection === 0 || ignore}
                    >
                      FUSIONNER LA SÉLECTION
                    </button>
                  </div>
                </div>

                {g.confiance.niveau === "FAIBLE" && (
                  <div className="avertissement-groupe">
                    ATTENTION : Ces fiches ont des noms différents. Vérifie
                    bien avant de fusionner. Ce sont peut-être deux personnes
                    distinctes.
                  </div>
                )}

                <div className="groupe-fiches">
                  {g.fiches.map((p) => {
                    const estGarde = edit.garde === p.id;
                    const estSelection = !!edit.selection[p.id];
                    const rec = edit.recuperations[p.id] || {};

                    return (
                      <div
                        key={p.id}
                        className={`fiche-groupe ${
                          estGarde
                            ? "fiche-garde"
                            : estSelection
                            ? "fiche-supprime"
                            : "fiche-neutre"
                        }`}
                      >
                        <div className="fiche-controle">
                          <label className="control-radio">
                            <input
                              type="radio"
                              name={`garde-${idx}`}
                              checked={estGarde}
                              onChange={() => changerGarde(idx, p.id)}
                              disabled={ignore}
                            />
                            <span>GARDER</span>
                          </label>

                          {!estGarde && (
                            <label className="control-check">
                              <input
                                type="checkbox"
                                checked={estSelection}
                                onChange={() => toggleSelection(idx, p.id)}
                                disabled={ignore}
                              />
                              <span>FUSIONNER</span>
                            </label>
                          )}
                        </div>

                        <div className="fiche-infos">
                          <strong>{p.personneId}</strong>
                          <small>
                            {p.nom} {p.prenom}
                          </small>
                          <small>Tel : {p.telephone || "-"}</small>
                          <small>
                            Département : {p.departement || "-"}
                          </small>
                          <small>
                            Statut :{" "}
                            {p.statut === "Oui"
                              ? "MEMBRE"
                              : p.statut === "Nouveau"
                              ? "NOUVEAU"
                              : p.statut === "Non"
                              ? "NON-MEMBRE"
                              : "-"}
                          </small>
                          <small>{p.nbPresences} présence(s)</small>
                        </div>

                        {estSelection && !estGarde && (
                          <div className="recuperation-champs">
                            <p className="recuperation-titre">
                              Récupérer depuis cette fiche :
                            </p>
                            {CHAMPS_FUSIONNABLES.map((c) => {
                              const valeur = p[c.key];
                              const vide =
                                valeur === undefined ||
                                valeur === null ||
                                valeur === "" ||
                                valeur === "-";
                              const different =
                                edit.garde &&
                                g.fiches.find((x) => x.id === edit.garde)?.[
                                  c.key
                                ] !== valeur;

                              return (
                                <label
                                  key={c.key}
                                  className={`champ-option ${
                                    vide ? "champ-vide" : ""
                                  } ${
                                    different ? "champ-different" : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!rec[c.key]}
                                    onChange={() =>
                                      toggleRecuperation(idx, p.id, c.key)
                                    }
                                    disabled={vide}
                                  />
                                  <span className="champ-label">
                                    {c.label}
                                  </span>
                                  <span className="champ-valeur">
                                    {vide ? "(vide)" : valeur}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {estGarde && (
                          <span className="tag-garde">BASE CONSERVÉE</span>
                        )}
                        {estSelection && (
                          <span className="tag-supprime">À FUSIONNER</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {apercu && nbSelection > 0 && (
                  <div className="apercu-fusion">
                    <p className="apercu-titre">RÉSULTAT APRÈS FUSION</p>
                    <div className="apercu-grille">
                      <div>
                        <span>NOM</span>
                        <strong>{apercu.nom || "-"}</strong>
                      </div>
                      <div>
                        <span>PRÉNOM</span>
                        <strong>{apercu.prenom || "-"}</strong>
                      </div>
                      <div>
                        <span>TÉLÉPHONE</span>
                        <strong>{apercu.telephone || "-"}</strong>
                      </div>
                      <div>
                        <span>DÉPARTEMENT</span>
                        <strong>{apercu.departement || "-"}</strong>
                      </div>
                      <div>
                        <span>STATUT</span>
                        <strong>{apercu.statut || "-"}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Nettoyage;