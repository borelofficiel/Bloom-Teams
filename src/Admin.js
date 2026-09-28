import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import db from "./firebase";
import "./Admin.css";
import Nettoyage from "./Nettoyage";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import * as XLSX from "xlsx";

function Admin() {

  /* =====================================================
     CONNEXION
  ===================================================== */

  const [estConnecte, setEstConnecte] = useState(false);
  const [nomUtilisateur, setNomUtilisateur] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurConnexion, setErreurConnexion] = useState("");

  const handleConnexion = (e) => {
    e.preventDefault();
    if (nomUtilisateur === "Patri bloom" && motDePasse === "BLOOMAVF") {
      setEstConnecte(true);
      setErreurConnexion("");
    } else {
      setErreurConnexion("Identifiants incorrects.");
      setMotDePasse("");
    }
  };

  /* =====================================================
     ONGLET ACTIF
  ===================================================== */

  const [ongletActif, setOngletActif] = useState("dashboard");

  /* =====================================================
     DONNÉES
  ===================================================== */

  const [presences, setPresences] = useState([]);
  const [personnes, setPersonnes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  /* =====================================================
     FILTRES
  ===================================================== */

  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("TOUS");
  const [filtreDepartement, setFiltreDepartement] = useState("TOUS");
  const [modeSuivi, setModeSuivi] = useState("samedis");
  const [filtreStat, setFiltreStat] = useState("samedis");

  /* =====================================================
     EXPORT
  ===================================================== */

  const [exportEnCours, setExportEnCours] = useState(false);

  /* =====================================================
     RÉCUPÉRATION
  ===================================================== */

  const recupererDonnees = async () => {
    setChargement(true);
    setErreur("");
    try {
      const personnesSnap = await getDocs(collection(db, "personnes"));
      const personnesData = personnesSnap.docs
        .filter((d) => d.id !== "_counter")
        .map((d) => ({ id: d.id, ...d.data() }));
      setPersonnes(personnesData);

      const presencesRef = collection(db, "presences");
      const req = query(presencesRef, orderBy("dateEnregistrement", "desc"));
      const resultat = await getDocs(req);
      const donnees = resultat.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPresences(donnees);
    } catch (err) {
      console.error("Erreur récupération:", err);
      setErreur("Impossible de récupérer les données.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    if (estConnecte) recupererDonnees();
  }, [estConnecte]);

  /* =====================================================
     DÉDOUBLONNAGE
  ===================================================== */

  const personnesUniques = useMemo(() => {
    const map = {};
    personnes.forEach((p) => {
      if (!p.personneId || p.personneId === "BT-TESTA-9999") return;
      if (!map[p.personneId]) map[p.personneId] = p;
    });
    return Object.values(map);
  }, [personnes]);

  const presencesValides = useMemo(() => {
    return presences.filter(
      (p) => p.personneId && p.personneId !== "BT-TESTA-9999"
    );
  }, [presences]);

  /* =====================================================
     STATS GÉNÉRALES
  ===================================================== */

  const totalPresences = presencesValides.length;
  const totalPersonnes = personnesUniques.length;

  const totalMembres = personnesUniques.filter((p) => p.statut === "Oui").length;
  const totalNonMembres = personnesUniques.filter((p) => p.statut === "Non").length;
  const totalNouveaux = personnesUniques.filter((p) => p.statut === "Nouveau").length;

  /* =====================================================
     STATS DÉPARTEMENTS
  ===================================================== */

  const statsDepartements = useMemo(() => {
    const map = {};
    personnesUniques.forEach((p) => {
      const d = p.departement || "Non défini";
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map)
      .map(([nom, valeur]) => ({ nom, valeur }))
      .sort((a, b) => b.valeur - a.valeur);
  }, [personnesUniques]);

  const statsStatuts = useMemo(
    () =>
      [
        { nom: "Membres", valeur: totalMembres },
        { nom: "Non-Membres", valeur: totalNonMembres },
        { nom: "Nouveaux", valeur: totalNouveaux },
      ].filter((i) => i.valeur > 0),
    [totalMembres, totalNonMembres, totalNouveaux]
  );

  /* =====================================================
     CALCUL DES JOURS
  ===================================================== */

  const maintenant = new Date();

  const obtenirSamedis = (date) => {
    const a = date.getFullYear();
    const m = date.getMonth();
    const res = [];
    const dLast = new Date(a, m + 1, 0);
    for (let j = 1; j <= dLast.getDate(); j++) {
      const d = new Date(a, m, j);
      if (d.getDay() === 6) res.push(d);
    }
    return res.slice(0, 4);
  };

  const obtenirDimanches = (date) => {
    const a = date.getFullYear();
    const m = date.getMonth();
    const res = [];
    const dLast = new Date(a, m + 1, 0);
    for (let j = 1; j <= dLast.getDate(); j++) {
      const d = new Date(a, m, j);
      if (d.getDay() === 0) res.push(d);
    }
    return res.slice(0, 4);
  };

  const obtenirTousLesJours = (date) => {
    const a = date.getFullYear();
    const m = date.getMonth();
    const res = [];
    const dLast = new Date(a, m + 1, 0);
    for (let j = 1; j <= dLast.getDate(); j++) {
      res.push(new Date(a, m, j));
    }
    return res;
  };

  const obtenirAujourdHui = () => [new Date()];

  const colonnesSuivi = useMemo(() => {
    switch (modeSuivi) {
      case "dimanches":
        return obtenirDimanches(maintenant);
      case "tous":
        return obtenirTousLesJours(maintenant);
      case "aujourdhui":
        return obtenirAujourdHui();
      default:
        return obtenirSamedis(maintenant);
    }
  }, [modeSuivi]);

  const samedis = obtenirSamedis(maintenant);
  const dimanches = obtenirDimanches(maintenant);

  /* =====================================================
     FORMAT DATE
  ===================================================== */

  const formaterDate = (d) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  const libelleColonne = (d, index) => {
    switch (modeSuivi) {
      case "dimanches":
        return { titre: `DIM. ${index + 1}`, sous: formaterDate(d) };
      case "tous":
        return {
          titre: d
            .toLocaleDateString("fr-FR", { weekday: "short" })
            .toUpperCase(),
          sous: formaterDate(d),
        };
      case "aujourdhui":
        return { titre: "AUJOURD'HUI", sous: formaterDate(d) };
      default:
        return { titre: `SAM. ${index + 1}`, sous: formaterDate(d) };
    }
  };

  const dateMatch = (presence, colonne) => {
    if (!presence.dateEnregistrement) return false;
    let dp;
    try {
      dp =
        typeof presence.dateEnregistrement.toDate === "function"
          ? presence.dateEnregistrement.toDate()
          : new Date(presence.dateEnregistrement);
    } catch {
      return false;
    }
    if (isNaN(dp.getTime())) return false;
    return (
      dp.getFullYear() === colonne.getFullYear() &&
      dp.getMonth() === colonne.getMonth() &&
      dp.getDate() === colonne.getDate()
    );
  };

  /* =====================================================
     NIVEAU
  ===================================================== */

  const obtenirNiveauActivite = (total) => {
    if (total === 4) return { nom: "SUPER ACTIF", classe: "super-actif" };
    if (total === 3) return { nom: "ACTIF", classe: "actif" };
    if (total === 2) return { nom: "A SUIVRE", classe: "a-suivre" };
    return { nom: "NON ACTIF", classe: "non-actif" };
  };

  /* =====================================================
     SUIVI MENSUEL
  ===================================================== */

  const suiviActivite = useMemo(() => {
    const map = {};

    personnesUniques.forEach((p) => {
      if (!p.personneId) return;
      map[p.personneId] = {
        personneId: p.personneId,
        nom: p.nom || "",
        prenom: p.prenom || "",
        telephone: p.telephone || "",
        statut: p.statut || "",
        departement: p.departement || "",
        colonnes: colonnesSuivi.map(() => false),
        samedis: samedis.map(() => false),
        dimanches: dimanches.map(() => false),
      };
    });

    presencesValides.forEach((p) => {
      if (!p.personneId || !map[p.personneId]) return;

      colonnesSuivi.forEach((col, i) => {
        if (dateMatch(p, col)) map[p.personneId].colonnes[i] = true;
      });

      samedis.forEach((s, i) => {
        if (dateMatch(p, s)) map[p.personneId].samedis[i] = true;
      });

      dimanches.forEach((d, i) => {
        if (dateMatch(p, d)) map[p.personneId].dimanches[i] = true;
      });
    });

    return Object.values(map).map((p) => {
      const totalSam = p.samedis.filter(Boolean).length;
      const totalDim = p.dimanches.filter(Boolean).length;
      const total =
        filtreStat === "dimanches"
          ? totalDim
          : filtreStat === "samedis"
          ? totalSam
          : totalSam + totalDim;
      return {
        ...p,
        total,
        totalSam,
        totalDim,
        niveau: obtenirNiveauActivite(total),
      };
    });
  }, [presencesValides, personnesUniques, colonnesSuivi, filtreStat]);

  /* =====================================================
     TOP 5 GLOBAL
  ===================================================== */

  const championGlobal = useMemo(() => {
    return [...suiviActivite].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [suiviActivite]);

  /* =====================================================
     CLASSEMENT PAR DÉPARTEMENT
  ===================================================== */

  const classementDepartements = useMemo(() => {
    const map = {};
    suiviActivite.forEach((p) => {
      const d = p.departement || "Non défini";
      if (!map[d]) map[d] = [];
      map[d].push(p);
    });

    return Object.entries(map)
      .map(([departement, personnes]) => {
        const tri = [...personnes].sort((a, b) => b.total - a.total);
        const totalPresences = personnes.reduce((s, p) => s + p.total, 0);
        return {
          departement,
          nombre: personnes.length,
          totalPresences,
          top3: tri.slice(0, 3),
        };
      })
      .sort((a, b) => b.totalPresences - a.totalPresences);
  }, [suiviActivite]);

  /* =====================================================
     FILTRES SUIVI
  ===================================================== */

  const suiviFiltre = suiviActivite.filter((p) => {
    const t = recherche.toLowerCase().trim();
    const nom = `${p.nom} ${p.prenom}`.toLowerCase();
    const tel = (p.telephone || "").toLowerCase();
    const id = p.personneId.toLowerCase();
    const matchRech = !t || nom.includes(t) || tel.includes(t) || id.includes(t);
    const matchStatut = filtreStatut === "TOUS" || p.statut === filtreStatut;
    const matchDept =
      filtreDepartement === "TOUS" || p.departement === filtreDepartement;
    return matchRech && matchStatut && matchDept;
  });

  /* =====================================================
     LISTE PERSONNES (onglet Personnes)
  ===================================================== */

  const personnesAffichees = useMemo(() => {
    return personnesUniques
      .filter((p) => {
        const t = recherche.toLowerCase().trim();
        const nom = `${p.nom || ""} ${p.prenom || ""}`.toLowerCase();
        const tel = (p.telephone || "").toLowerCase();
        const id = (p.personneId || "").toLowerCase();
        const matchRech =
          !t || nom.includes(t) || tel.includes(t) || id.includes(t);
        const matchStatut = filtreStatut === "TOUS" || p.statut === filtreStatut;
        const matchDept =
          filtreDepartement === "TOUS" || p.departement === filtreDepartement;
        return matchRech && matchStatut && matchDept;
      })
      .sort((a, b) => {
        const na = parseInt((a.personneId || "").replace(/\D/g, "")) || 0;
        const nb = parseInt((b.personneId || "").replace(/\D/g, "")) || 0;
        return na - nb;
      });
  }, [personnesUniques, recherche, filtreStatut, filtreDepartement]);

  /* =====================================================
     STATS ACTIVITÉ
  ===================================================== */

  const totalSuperActifs = suiviActivite.filter((p) => p.total === 4).length;
  const totalActifs = suiviActivite.filter((p) => p.total === 3).length;
  const totalASuivre = suiviActivite.filter((p) => p.total === 2).length;
  const totalNonActifs = suiviActivite.filter((p) => p.total <= 1).length;

  const donneesActivite = useMemo(
    () =>
      [
        { nom: "SUPER ACTIF", valeur: totalSuperActifs, couleur: "#111111" },
        { nom: "ACTIF", valeur: totalActifs, couleur: "#555555" },
        { nom: "A SUIVRE", valeur: totalASuivre, couleur: "#999999" },
        { nom: "NON ACTIF", valeur: totalNonActifs, couleur: "#d5d5d5" },
      ].filter((i) => i.valeur > 0),
    [totalSuperActifs, totalActifs, totalASuivre, totalNonActifs]
  );

  /* =====================================================
     ÉVOLUTION
  ===================================================== */

  const donneesEvolution = useMemo(() => {
    const map = {};
    presencesValides.forEach((p) => {
      if (!p.dateEnregistrement) return;
      let d;
      try {
        d =
          typeof p.dateEnregistrement.toDate === "function"
            ? p.dateEnregistrement.toDate()
            : new Date(p.dateEnregistrement);
      } catch {
        return;
      }
      if (isNaN(d.getTime())) return;
      const jour = d.getDay();
      const diff = d.getDate() - jour + (jour === 0 ? -6 : 1);
      const debut = new Date(d);
      debut.setDate(diff);
      debut.setHours(0, 0, 0, 0);
      const cle = debut.toISOString().split("T")[0];
      const lib = `Sem. ${debut.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      })}`;
      if (!map[cle]) map[cle] = { date: cle, libelle: lib, total: 0 };
      map[cle].total++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [presencesValides]);

  /* =====================================================
     EXPORTS
  ===================================================== */

  const exporterListe = (donnees, nomFichier, feuille) => {
    if (!donnees || donnees.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(donnees);
    ws["!cols"] = Object.keys(donnees[0]).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, feuille || "Export");
    XLSX.writeFile(wb, nomFichier);
  };

  const exporterListePersonnes = () => {
    setExportEnCours(true);
    try {
      const donnees = personnesAffichees.map((p, i) => ({
        "#": i + 1,
        ID: p.personneId,
        Nom: p.nom,
        Prenom: p.prenom,
        Telephone: p.telephone || "",
        Statut:
          p.statut === "Oui"
            ? "MEMBRE"
            : p.statut === "Nouveau"
            ? "NOUVEAU"
            : p.statut === "Non"
            ? "NON-MEMBRE"
            : "",
        Departement: p.departement || "",
      }));
      exporterListe(donnees, `BLOOM_PERSONNES.xlsx`, "Personnes");
    } finally {
      setExportEnCours(false);
    }
  };

  const exporterParSamedi = (index) => {
    setExportEnCours(true);
    try {
      const samedi = samedis[index];
      if (!samedi) return alert("Samedi introuvable.");
      const dateStr = samedi.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const presents = suiviActivite.filter((p) => p.samedis[index]);
      const donnees = presents.map((p, i) => ({
        "#": i + 1,
        ID: p.personneId,
        Nom: p.nom,
        Prenom: p.prenom,
        Telephone: p.telephone,
        Statut: p.statut || "-",
        Departement: p.departement || "-",
        Date: dateStr,
      }));
      exporterListe(
        donnees,
        `BLOOM_Samedi_${index + 1}.xlsx`,
        `Samedi ${index + 1}`
      );
    } finally {
      setExportEnCours(false);
    }
  };

  const exporterTousSamedis = () => {
    setExportEnCours(true);
    try {
      const wb = XLSX.utils.book_new();
      samedis.forEach((s, i) => {
        const dateStr = s.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        const presents = suiviActivite.filter((p) => p.samedis[i]);
        const donnees = presents.map((p, idx) => ({
          "#": idx + 1,
          ID: p.personneId,
          Nom: p.nom,
          Prenom: p.prenom,
          Telephone: p.telephone,
          Statut: p.statut || "-",
          Departement: p.departement || "-",
          Date: dateStr,
        }));
        const ws = XLSX.utils.json_to_sheet(
          donnees.length ? donnees : [{ Info: "Aucune presence" }]
        );
        ws["!cols"] = Array(7).fill({ wch: 18 });
        XLSX.utils.book_append_sheet(wb, ws, `Samedi ${i + 1}`);
      });
      XLSX.writeFile(wb, `BLOOM_TOUS_SAMEDIS.xlsx`);
    } finally {
      setExportEnCours(false);
    }
  };

  const exporterSuiviComplet = () => {
    setExportEnCours(true);
    try {
      const donnees = suiviFiltre.map((p, i) => {
        const ligne = {
          "#": i + 1,
          ID: p.personneId,
          Nom: p.nom,
          Prenom: p.prenom,
          Telephone: p.telephone,
          Statut: p.statut || "-",
          Departement: p.departement || "-",
        };
        colonnesSuivi.forEach((c, idx) => {
          ligne[`Col ${idx + 1} (${formaterDate(c)})`] = p.colonnes[idx]
            ? "Present"
            : "-";
        });
        ligne["Total Samedis"] = p.totalSam;
        ligne["Total Dimanches"] = p.totalDim;
        ligne["TOTAL"] = p.total;
        ligne["Niveau"] = p.niveau.nom;
        return ligne;
      });
      exporterListe(donnees, `BLOOM_SUIVI.xlsx`, "Suivi");
    } finally {
      setExportEnCours(false);
    }
  };

  const exporterParDepartement = () => {
    setExportEnCours(true);
    try {
      const wb = XLSX.utils.book_new();
      classementDepartements.forEach((d) => {
        const donnees = d.top3.map((p, i) => ({
          "#": i + 1,
          ID: p.personneId,
          Nom: p.nom,
          Prenom: p.prenom,
          Telephone: p.telephone,
          "Total Samedis": p.totalSam,
          "Total Dimanches": p.totalDim,
          TOTAL: p.total,
          Niveau: p.niveau.nom,
        }));
        const ws = XLSX.utils.json_to_sheet(
          donnees.length ? donnees : [{ Info: "Aucune donnee" }]
        );
        ws["!cols"] = Array(8).fill({ wch: 18 });
        XLSX.utils.book_append_sheet(wb, ws, d.departement.substring(0, 28));
      });
      XLSX.writeFile(wb, `BLOOM_PAR_DEPARTEMENT.xlsx`);
    } finally {
      setExportEnCours(false);
    }
  };

  const exporterTopActifs = () => {
    setExportEnCours(true);
    try {
      const donnees = championGlobal.map((p, i) => ({
        Rang: i + 1,
        ID: p.personneId,
        Nom: p.nom,
        Prenom: p.prenom,
        Departement: p.departement || "-",
        "Total Samedis": p.totalSam,
        "Total Dimanches": p.totalDim,
        TOTAL: p.total,
        Niveau: p.niveau.nom,
      }));
      exporterListe(donnees, `BLOOM_TOP_ACTIFS.xlsx`, "Top");
    } finally {
      setExportEnCours(false);
    }
  };

  /* =====================================================
     MOIS
  ===================================================== */

  const moisActuel = new Date().toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  /* =====================================================
     CONNEXION
  ===================================================== */

  if (!estConnecte) {
    return (
      <div className="admin-page">
        <div className="connexion-container">
          <div className="connexion-box">
            <div className="connexion-logo">
              <span>BLOOM</span>
              <small>TEAMS ADMIN</small>
            </div>
            <h2>CONNEXION</h2>
            <p className="connexion-sous-titre">
              Veuillez vous identifier pour continuer
            </p>
            <form onSubmit={handleConnexion} className="connexion-form">
              <div className="connexion-groupe">
                <label>NOM D'UTILISATEUR</label>
                <input
                  type="text"
                  value={nomUtilisateur}
                  onChange={(e) => setNomUtilisateur(e.target.value)}
                  required
                />
              </div>
              <div className="connexion-groupe">
                <label>MOT DE PASSE</label>
                <input
                  type="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
              </div>
              {erreurConnexion && (
                <div className="connexion-erreur">{erreurConnexion}</div>
              )}
              <button type="submit" className="connexion-bouton">
                SE CONNECTER
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     RENDU
  ===================================================== */

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          BLOOM
          <span>TEAMS ADMIN</span>
        </div>
        <nav className="admin-menu">
          <a
            href="#dashboard"
            className={ongletActif === "dashboard" ? "menu-actif" : ""}
            onClick={(e) => {
              e.preventDefault();
              setOngletActif("dashboard");
            }}
          >
            TABLEAU DE BORD
          </a>
          <a
            href="#personnes"
            className={ongletActif === "personnes" ? "menu-actif" : ""}
            onClick={(e) => {
              e.preventDefault();
              setOngletActif("personnes");
            }}
          >
            PERSONNES
          </a>
          <a
            href="#statistiques"
            className={ongletActif === "statistiques" ? "menu-actif" : ""}
            onClick={(e) => {
              e.preventDefault();
              setOngletActif("statistiques");
            }}
          >
            STATISTIQUES
          </a>
          <a
            href="#nettoyage"
            className={ongletActif === "nettoyage" ? "menu-actif" : ""}
            onClick={(e) => {
              e.preventDefault();
              setOngletActif("nettoyage");
            }}
          >
            NETTOYAGE
          </a>
        </nav>
        <div className="admin-sidebar-bas">
          <div className="admin-indicateur">
            <span></span> FIREBASE CONNECTÉ
          </div>
          <button
            className="bouton-deconnexion"
            onClick={() => {
              setEstConnecte(false);
              setNomUtilisateur("");
              setMotDePasse("");
            }}
          >
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="admin-contenu">
        {/* HEADER */}
        <div className="admin-header">
          <div>
            <p className="admin-sur-titre">BLOOM TEAMS</p>
            <h1>
              {ongletActif === "dashboard"
                ? "TABLEAU DE BORD"
                : ongletActif === "personnes"
                ? "PERSONNES"
                : ongletActif === "nettoyage"
                ? "NETTOYAGE"
                : "STATISTIQUES"}
            </h1>
            <p className="admin-description">
              {ongletActif === "dashboard"
                ? "Suivi des présences et de l'activité."
                : ongletActif === "personnes"
                ? "Liste complète des personnes enregistrées."
                : ongletActif === "nettoyage"
                ? "Fusion des fiches en double."
                : "Analyse statistique et exports."}
            </p>
          </div>
          <div className="admin-actions">
            <button
              className="bouton-actualiser"
              onClick={recupererDonnees}
              disabled={chargement}
            >
              {chargement ? "CHARGEMENT" : "ACTUALISER"}
            </button>
            <div className="profil-admin">
              <div className="avatar-admin">P</div>
              <div>
                <strong>Patri bloom</strong>
                <small>Administrateur</small>
              </div>
            </div>
          </div>
        </div>

        {erreur && <div className="admin-erreur">{erreur}</div>}

        {/* ============================================
            ONGLET DASHBOARD
        ============================================ */}
        {ongletActif === "dashboard" && (
          <>
            <section className="cartes-statistiques">
              <div className="carte-statistique" style={{ borderTop: "4px solid #ff007f" }}>
                <div>
                  <p>TOTAL PERSONNES</p>
                  <strong>{totalPersonnes}</strong>
                </div>
              </div>
              <div className="carte-statistique" style={{ borderTop: "4px solid #76ee59" }}>
                <div>
                  <p>TOTAL PRÉSENCES</p>
                  <strong>{totalPresences}</strong>
                </div>
              </div>
              <div className="carte-statistique" style={{ borderTop: "4px solid #40d0e0" }}>
                <div>
                  <p>MEMBRES</p>
                  <strong>{totalMembres}</strong>
                </div>
              </div>
              <div className="carte-statistique" style={{ borderTop: "4px solid #feca57" }}>
                <div>
                  <p>NON-MEMBRES</p>
                  <strong>{totalNonMembres}</strong>
                </div>
              </div>
              <div className="carte-statistique" style={{ borderTop: "4px solid #ff6b6b" }}>
                <div>
                  <p>NOUVEAUX</p>
                  <strong>{totalNouveaux}</strong>
                </div>
              </div>
            </section>

            <section className="section-activite">
              <div className="titre-activite">
                <div>
                  <p>SUIVI MENSUEL</p>
                  <h2>SUIVI DE L'ACTIVITÉ</h2>
                  <span>{moisActuel}</span>
                </div>
                <div className="resume-activite">
                  <div style={{ borderBottom: "3px solid #111" }}>
                    <strong>{totalSuperActifs}</strong>
                    <span>SUPER ACTIFS</span>
                  </div>
                  <div style={{ borderBottom: "3px solid #555" }}>
                    <strong>{totalActifs}</strong>
                    <span>ACTIFS</span>
                  </div>
                  <div style={{ borderBottom: "3px solid #999" }}>
                    <strong>{totalASuivre}</strong>
                    <span>A SUIVRE</span>
                  </div>
                  <div style={{ borderBottom: "3px solid #d5d5d5" }}>
                    <strong>{totalNonActifs}</strong>
                    <span>NON ACTIFS</span>
                  </div>
                </div>
              </div>

              <div className="barre-filtres-suivi">
                <div className="filtre-admin">
                  <label>AFFICHER</label>
                  <select
                    value={modeSuivi}
                    onChange={(e) => setModeSuivi(e.target.value)}
                  >
                    <option value="samedis">4 SAMEDIS DU MOIS</option>
                    <option value="dimanches">4 DIMANCHES DU MOIS</option>
                    <option value="tous">TOUS LES JOURS DU MOIS</option>
                    <option value="aujourdhui">AUJOURD'HUI</option>
                  </select>
                </div>
                <div className="filtre-admin">
                  <label>RECHERCHE</label>
                  <input
                    type="text"
                    placeholder="Nom, ID, téléphone..."
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                  />
                </div>
                <div className="filtre-admin">
                  <label>STATUT</label>
                  <select
                    value={filtreStatut}
                    onChange={(e) => setFiltreStatut(e.target.value)}
                  >
                    <option value="TOUS">TOUS</option>
                    <option value="Oui">MEMBRES</option>
                    <option value="Non">NON-MEMBRES</option>
                    <option value="Nouveau">NOUVEAUX</option>
                  </select>
                </div>
                <div className="filtre-admin">
                  <label>DÉPARTEMENT</label>
                  <select
                    value={filtreDepartement}
                    onChange={(e) => setFiltreDepartement(e.target.value)}
                  >
                    <option value="TOUS">TOUS</option>
                    {statsDepartements.map((d) => (
                      <option key={d.nom} value={d.nom}>
                        {d.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="legende-activite">
                <span>
                  <b className="point-super-actif"></b>4/4 SUPER ACTIF
                </span>
                <span>
                  <b className="point-actif"></b>3/4 ACTIF
                </span>
                <span>
                  <b className="point-a-suivre"></b>2/4 A SUIVRE
                </span>
                <span>
                  <b className="point-non-actif"></b>0-1/4 NON ACTIF
                </span>
              </div>

              {suiviFiltre.length === 0 ? (
                <div className="etat-activite">
                  <strong>AUCUNE PERSONNE</strong>
                </div>
              ) : (
                <div className="tableau-activite-wrapper scroll-interne">
                  <table className="tableau-activite">
                    <thead>
                      <tr>
                        <th>PERSONNE</th>
                        {colonnesSuivi.map((col, i) => {
                          const l = libelleColonne(col, i);
                          return (
                            <th key={col.toISOString()}>
                              {l.titre}
                              <small>{l.sous}</small>
                            </th>
                          );
                        })}
                        <th>TOTAL</th>
                        <th>NIVEAU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suiviFiltre.map((p) => (
                        <tr key={p.personneId}>
                          <td>
                            <div className="personne-activite">
                              <div className="avatar-activite">
                                {(p.prenom?.charAt(0) ||
                                  p.nom?.charAt(0) ||
                                  "?").toUpperCase()}
                              </div>
                              <div>
                                <strong>
                                  <span className="badge-id-mini">
                                    {p.personneId}
                                  </span>
                                  {p.nom} {p.prenom}
                                </strong>
                                <small>{p.telephone}</small>
                              </div>
                            </div>
                          </td>
                          {p.colonnes.map((present, i) => (
                            <td key={i} className="cellule-samedi">
                              {present ? (
                                <span className="presence-oui">OK</span>
                              ) : (
                                <span className="presence-non">-</span>
                              )}
                            </td>
                          ))}
                          <td>
                            <strong className="total-activite">
                              {p.total}/{colonnesSuivi.length}
                            </strong>
                          </td>
                          <td>
                            <span className={`badge-activite ${p.niveau.classe}`}>
                              {p.niveau.nom}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="actions-export-mini">
                <button
                  className="bouton-export-mini"
                  onClick={exporterSuiviComplet}
                  disabled={exportEnCours || suiviFiltre.length === 0}
                >
                  EXPORTER LE SUIVI FILTRÉ
                </button>
              </div>
            </section>
          </>
        )}

        {/* ============================================
            ONGLET PERSONNES
        ============================================ */}
        {ongletActif === "personnes" && (
          <>
            <section className="carte-total-personnes">
              <div>
                <p className="admin-sur-titre">TOTAL ENREGISTRÉ</p>
                <h2>NOMBRE TOTAL DE PERSONNES</h2>
              </div>
              <div className="total-grand">
                <strong>{totalPersonnes}</strong>
                <span>personne(s)</span>
              </div>
            </section>

            <section className="barre-filtres-presences">
              <div className="filtre-admin">
                <label>RECHERCHE</label>
                <input
                  type="text"
                  placeholder="Nom, ID, téléphone..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              <div className="filtre-admin">
                <label>STATUT</label>
                <select
                  value={filtreStatut}
                  onChange={(e) => setFiltreStatut(e.target.value)}
                >
                  <option value="TOUS">TOUS</option>
                  <option value="Oui">MEMBRES</option>
                  <option value="Non">NON-MEMBRES</option>
                  <option value="Nouveau">NOUVEAUX</option>
                </select>
              </div>
              <div className="filtre-admin">
                <label>DÉPARTEMENT</label>
                <select
                  value={filtreDepartement}
                  onChange={(e) => setFiltreDepartement(e.target.value)}
                >
                  <option value="TOUS">TOUS</option>
                  {statsDepartements.map((d) => (
                    <option key={d.nom} value={d.nom}>
                      {d.nom}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="section-tableau">
              <div className="titre-tableau">
                <div>
                  <p>FICHES ENREGISTRÉES</p>
                  <h3>LISTE COMPLÈTE DES PERSONNES</h3>
                </div>
                <span>{personnesAffichees.length} résultat(s)</span>
              </div>

              {chargement ? (
                <div className="etat-tableau">
                  <div className="chargement">CHARGEMENT...</div>
                </div>
              ) : personnesAffichees.length === 0 ? (
                <div className="etat-tableau">
                  <div className="aucune-donnee">
                    <strong>AUCUNE DONNÉE</strong>
                  </div>
                </div>
              ) : (
                <div className="tableau-wrapper scroll-interne">
                  <table className="tableau-presences">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>ID</th>
                        <th>NOM</th>
                        <th>PRÉNOM</th>
                        <th>TÉLÉPHONE</th>
                        <th>STATUT</th>
                        <th>DÉPARTEMENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personnesAffichees.map((p, i) => (
                        <tr key={p.id}>
                          <td>{i + 1}</td>
                          <td>
                            <span className="badge-id">{p.personneId}</span>
                          </td>
                          <td>
                            <strong>{p.nom}</strong>
                          </td>
                          <td>{p.prenom}</td>
                          <td>{p.telephone || "-"}</td>
                          <td>
                            <span
                              className={
                                p.statut === "Oui"
                                  ? "badge-membre"
                                  : p.statut === "Nouveau"
                                  ? "badge-nouveau"
                                  : "badge-non-membre"
                              }
                            >
                              {p.statut === "Oui"
                                ? "MEMBRE"
                                : p.statut === "Nouveau"
                                ? "NOUVEAU"
                                : p.statut === "Non"
                                ? "NON-MEMBRE"
                                : "-"}
                            </span>
                          </td>
                          <td>{p.departement || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="actions-export-mini">
                <button
                  className="bouton-export-mini"
                  onClick={exporterListePersonnes}
                  disabled={exportEnCours || personnesAffichees.length === 0}
                >
                  EXPORTER LA LISTE EN EXCEL
                </button>
              </div>
            </section>
          </>
        )}

        {/* ============================================
            ONGLET STATISTIQUES
        ============================================ */}
        {ongletActif === "statistiques" && (
          <>
            <section className="barre-filtres-stat">
              <div className="filtre-admin">
                <label>TYPE DE CULTE</label>
                <select
                  value={filtreStat}
                  onChange={(e) => setFiltreStat(e.target.value)}
                >
                  <option value="samedis">SAMEDIS UNIQUEMENT</option>
                  <option value="dimanches">DIMANCHES UNIQUEMENT</option>
                  <option value="tous">SAMEDIS + DIMANCHES</option>
                </select>
              </div>
            </section>

            <section className="section-statistiques">
              <div className="grille-graphiques">
                <div className="carte-graphique">
                  <h4>RÉPARTITION DES STATUTS</h4>
                  {statsStatuts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={statsStatuts}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={5}
                          dataKey="valeur"
                          label={({ nom, valeur }) => `${nom}: ${valeur}`}
                          labelLine={false}
                        >
                          {statsStatuts.map((_, i) => (
                            <Cell
                              key={i}
                              fill={["#ff007f", "#76ee59", "#40d0e0"][i % 3]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="aucune-donnee">Aucune donnée</div>
                  )}
                </div>

                <div className="carte-graphique">
                  <h4>NIVEAU D'ACTIVITÉ</h4>
                  {donneesActivite.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={donneesActivite}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nom" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="valeur" radius={[4, 4, 0, 0]}>
                          {donneesActivite.map((e, i) => (
                            <Cell key={i} fill={e.couleur} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="aucune-donnee">Aucune donnée</div>
                  )}
                </div>
              </div>

              <div className="grille-graphiques">
                <div className="carte-graphique">
                  <h4>ÉVOLUTION DES PRÉSENCES</h4>
                  {donneesEvolution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={donneesEvolution}>
                        <defs>
                          <linearGradient
                            id="colorTotal"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#ff007f"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#ff007f"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="libelle" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke="#ff007f"
                          fillOpacity={1}
                          fill="url(#colorTotal)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="aucune-donnee">Aucune donnée</div>
                  )}
                </div>

                <div className="carte-graphique">
                  <h4>RÉPARTITION PAR DÉPARTEMENT</h4>
                  {statsDepartements.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={statsDepartements}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          dataKey="nom"
                          type="category"
                          tick={{ fontSize: 10 }}
                          width={100}
                        />
                        <Tooltip />
                        <Bar dataKey="valeur" radius={[0, 4, 4, 0]}>
                          {statsDepartements.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                [
                                  "#ff007f",
                                  "#76ee59",
                                  "#40d0e0",
                                  "#0a3663",
                                  "#feca57",
                                  "#ff6b6b",
                                  "#48dbfb",
                                ][i % 7]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="aucune-donnee">Aucune donnée</div>
                  )}
                </div>
              </div>
            </section>

            <section className="bloc-champion">
              <div className="titre-champion">
                <p className="admin-sur-titre">CLASSEMENT GÉNÉRAL</p>
                <h3>TOP 5 DES PLUS RÉGULIERS</h3>
                <p>
                  Classement basé sur :{" "}
                  {filtreStat === "dimanches"
                    ? "les dimanches"
                    : filtreStat === "samedis"
                    ? "les samedis"
                    : "samedis + dimanches"}
                  .
                </p>
              </div>

              <div className="liste-champion">
                {championGlobal.map((p, i) => (
                  <div
                    key={p.personneId}
                    className={`carte-champion rang-${i + 1}`}
                  >
                    <div className="rang-champion">#{i + 1}</div>
                    <div className="avatar-activite">
                      {(p.prenom?.charAt(0) || p.nom?.charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="infos-champion">
                      <strong>
                        {p.nom} {p.prenom}
                      </strong>
                      <small>
                        {p.departement || "Non défini"} — {p.personneId}
                      </small>
                    </div>
                    <div className="score-champion">
                      <strong>{p.total}</strong>
                      <span>{p.niveau.nom}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="bouton-export-mini"
                onClick={exporterTopActifs}
                disabled={exportEnCours || championGlobal.length === 0}
              >
                EXPORTER LE TOP 5
              </button>
            </section>

            <section className="bloc-departements">
              <div className="titre-champion">
                <p className="admin-sur-titre">DÉTAIL PAR DÉPARTEMENT</p>
                <h3>TOP 3 PAR DÉPARTEMENT</h3>
                <p>
                  Les trois personnes les plus régulières de chaque département.
                </p>
              </div>

              <div className="grille-departements">
                {classementDepartements.map((d) => (
                  <div key={d.departement} className="carte-departement">
                    <div className="entete-departement">
                      <h4>{d.departement}</h4>
                      <span>
                        {d.nombre} personne(s) — {d.totalPresences} présence(s)
                      </span>
                    </div>
                    <div className="liste-top3">
                      {d.top3.map((p, i) => (
                        <div key={p.personneId} className="ligne-top3">
                          <span className="rang-top3">#{i + 1}</span>
                          <div className="infos-top3">
                            <strong>
                              {p.nom} {p.prenom}
                            </strong>
                            <small>{p.personneId}</small>
                          </div>
                          <span className="score-top3">{p.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="bouton-export-mini"
                onClick={exporterParDepartement}
                disabled={exportEnCours || classementDepartements.length === 0}
              >
                EXPORTER PAR DÉPARTEMENT
              </button>
            </section>

            <section className="section-export">
              <div className="titre-export">
                <p className="admin-sur-titre">EXPORT EXCEL</p>
                <h3>EXPORTS DISPONIBLES</h3>
                <p>Sélectionnez le type d'export souhaité.</p>
              </div>

              <div className="boutons-export">
                {samedis.map((s, i) => {
                  const dateF = s.toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  });
                  const nb = suiviActivite.filter((p) => p.samedis[i]).length;
                  return (
                    <button
                      key={i}
                      className="bouton-export"
                      onClick={() => exporterParSamedi(i)}
                      disabled={exportEnCours || nb === 0}
                      style={{
                        background: nb > 0 ? "#0a3663" : "#ccc",
                        cursor: nb > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      <div>
                        <strong>Samedi {i + 1}</strong>
                        <small>
                          {dateF} — {nb} présent(s)
                        </small>
                      </div>
                    </button>
                  );
                })}

                <button
                  className="bouton-export"
                  onClick={exporterTousSamedis}
                  disabled={exportEnCours}
                  style={{ background: "#ff007f" }}
                >
                  <div>
                    <strong>TOUS LES SAMEDIS</strong>
                    <small>Un fichier, plusieurs feuilles</small>
                  </div>
                </button>

                <button
                  className="bouton-export"
                  onClick={exporterSuiviComplet}
                  disabled={exportEnCours || suiviFiltre.length === 0}
                  style={{ background: "#76ee59", color: "#050505" }}
                >
                  <div>
                    <strong>SUIVI COMPLET</strong>
                    <small>{suiviFiltre.length} personne(s)</small>
                  </div>
                </button>

                <button
                  className="bouton-export"
                  onClick={exporterListePersonnes}
                  disabled={exportEnCours || personnesAffichees.length === 0}
                  style={{ background: "#40d0e0", color: "#050505" }}
                >
                  <div>
                    <strong>LISTE PERSONNES</strong>
                    <small>{personnesAffichees.length} ligne(s)</small>
                  </div>
                </button>

                <button
                  className="bouton-export"
                  onClick={exporterParDepartement}
                  disabled={exportEnCours}
                  style={{ background: "#feca57", color: "#050505" }}
                >
                  <div>
                    <strong>PAR DÉPARTEMENT</strong>
                    <small>Une feuille par département</small>
                  </div>
                </button>

                <button
                  className="bouton-export"
                  onClick={exporterTopActifs}
                  disabled={exportEnCours}
                  style={{ background: "#050505" }}
                >
                  <div>
                    <strong>TOP ACTIFS</strong>
                    <small>Top 5 plus réguliers</small>
                  </div>
                </button>
              </div>
            </section>
          </>
        )}

        {/* ============================================
            ONGLET NETTOYAGE
        ============================================ */}
        {ongletActif === "nettoyage" && <Nettoyage />}

        <footer className="admin-footer">
          <span>BLOOM TEAMS</span>
          <span>ADMINISTRATION</span>
          <span>2026</span>
        </footer>
      </div>
    </div>
  );
}

export default Admin;