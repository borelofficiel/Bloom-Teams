import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import db from "./firebase";
import "./Admin.css";

// Import des librairies pour les graphiques et Excel
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
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
      setErreurConnexion("❌ Identifiants incorrects. Veuillez réessayer.");
      setMotDePasse("");
    }
  };

  /* =====================================================
     ONGLET ACTIF
  ===================================================== */

  const [ongletActif, setOngletActif] = useState("dashboard");

  /* =====================================================
     DONNÉES FIREBASE
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

  /* =====================================================
     EXPORT EXCEL
  ===================================================== */

  const [exportEnCours, setExportEnCours] = useState(false);

  /* =====================================================
     RÉCUPÉRATION DES DONNÉES
  ===================================================== */

  const recupererDonnees = async () => {
    setChargement(true);
    setErreur("");

    try {
      const personnesRef = collection(db, "personnes");
      const personnesSnapshot = await getDocs(personnesRef);
      const personnesData = personnesSnapshot.docs
        .filter((doc) => doc.id !== "_counter")
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      setPersonnes(personnesData);

      const presencesRef = collection(db, "presences");
      const requete = query(presencesRef, orderBy("dateEnregistrement", "desc"));
      const resultat = await getDocs(requete);
      const donnees = resultat.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      setPresences(donnees);

      console.log("✅ Personnes récupérées :", personnesData.length);
      console.log("✅ Présences récupérées :", donnees.length);
    } catch (erreurFirebase) {
      console.error("Erreur lors de la récupération :", erreurFirebase);
      setErreur("Impossible de récupérer les données depuis Firebase.");
    } finally {
      setChargement(false);
    }
  };

  /* =====================================================
     CHARGEMENT INITIAL
  ===================================================== */

  useEffect(() => {
    if (estConnecte) {
      recupererDonnees();
    }
  }, [estConnecte]);

  /* =====================================================
     STATISTIQUES GÉNÉRALES
  ===================================================== */

  const totalPresences = presences.length;
  const totalPersonnes = personnes.length;

  const totalMembres = personnes.filter(
    (personne) => personne.statut === "Oui"
  ).length;

  const totalNonMembres = personnes.filter(
    (personne) => personne.statut === "Non"
  ).length;

  const totalNouveaux = personnes.filter(
    (personne) => personne.statut === "Nouveau"
  ).length;

  /* =====================================================
     DÉPARTEMENTS
  ===================================================== */

  const statsDepartements = useMemo(() => {
    const deptMap = {};
    personnes.forEach((personne) => {
      const dept = personne.departement || "Non défini";
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    return Object.entries(deptMap)
      .map(([nom, valeur]) => ({ nom, valeur }))
      .sort((a, b) => b.valeur - a.valeur);
  }, [personnes]);

  /* =====================================================
     STATUTS
  ===================================================== */

  const statsStatuts = useMemo(() => {
    return [
      { nom: "Membres", valeur: totalMembres },
      { nom: "Non-Membres", valeur: totalNonMembres },
      { nom: "Nouveaux", valeur: totalNouveaux },
    ].filter((item) => item.valeur > 0);
  }, [totalMembres, totalNonMembres, totalNouveaux]);

  /* =====================================================
     DONNÉES POUR LE GRAPHIQUE D'ÉVOLUTION
  ===================================================== */

  const donneesEvolution = useMemo(() => {
    const semaineMap = {};
    presences.forEach((presence) => {
      if (!presence.dateEnregistrement) return;
      
      let date;
      try {
        if (typeof presence.dateEnregistrement.toDate === "function") {
          date = presence.dateEnregistrement.toDate();
        } else {
          date = new Date(presence.dateEnregistrement);
        }
      } catch {
        return;
      }

      if (isNaN(date.getTime())) return;

      const jour = date.getDay();
      const diff = date.getDate() - jour + (jour === 0 ? -6 : 1);
      const debutSemaine = new Date(date);
      debutSemaine.setDate(diff);
      debutSemaine.setHours(0, 0, 0, 0);

      const cle = debutSemaine.toISOString().split("T")[0];
      const libelle = `Sem. ${debutSemaine.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      })}`;

      if (!semaineMap[cle]) {
        semaineMap[cle] = { date: cle, libelle, total: 0 };
      }
      semaineMap[cle].total++;
    });

    return Object.values(semaineMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [presences]);

  /* =====================================================
     RECHERCHE + FILTRE (PRÉSENCES)
  ===================================================== */

  const presencesFiltrees = presences.filter((presence) => {
    const texteRecherche = recherche.toLowerCase().trim();

    const nomComplet = `${presence.nom || ""} ${presence.prenom || ""}`.toLowerCase();
    const telephone = presence.telephone || "";
    const personneId = presence.personneId || "";

    const correspondRecherche =
      nomComplet.includes(texteRecherche) ||
      telephone.includes(texteRecherche) ||
      personneId.toLowerCase().includes(texteRecherche);

    const correspondStatut =
      filtreStatut === "TOUS" || presence.statut === filtreStatut;

    return correspondRecherche && correspondStatut;
  });

  /* =====================================================
     DÉTERMINER LES 4 SAMEDIS DU MOIS
  ===================================================== */

  const obtenirSamedisDuMois = (date) => {
    const annee = date.getFullYear();
    const mois = date.getMonth();

    const samedis = [];
    const dernierJour = new Date(annee, mois + 1, 0);

    for (let jour = 1; jour <= dernierJour.getDate(); jour++) {
      const dateJour = new Date(annee, mois, jour);
      if (dateJour.getDay() === 6) {
        samedis.push(dateJour);
      }
    }

    return samedis.slice(0, 4);
  };

  /* =====================================================
     FORMATAGE DATE
  ===================================================== */

  const formaterDate = (date) => {
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  /* =====================================================
     VÉRIFIER SI UNE PRÉSENCE CORRESPOND À UN SAMEDI
  ===================================================== */

  const presenceCorrespondAuSamedi = (presence, samedi) => {
    if (!presence.dateEnregistrement) {
      return false;
    }

    let datePresence;

    try {
      if (typeof presence.dateEnregistrement.toDate === "function") {
        datePresence = presence.dateEnregistrement.toDate();
      } else {
        datePresence = new Date(presence.dateEnregistrement);
      }
    } catch {
      return false;
    }

    if (Number.isNaN(datePresence.getTime())) {
      return false;
    }

    return (
      datePresence.getFullYear() === samedi.getFullYear() &&
      datePresence.getMonth() === samedi.getMonth() &&
      datePresence.getDate() === samedi.getDate()
    );
  };

  /* =====================================================
     CALCUL DU NIVEAU D'ACTIVITÉ
  ===================================================== */

  const obtenirNiveauActivite = (total) => {
    if (total === 4) {
      return { nom: "SUPER ACTIF", classe: "super-actif" };
    }
    if (total === 3) {
      return { nom: "ACTIF", classe: "actif" };
    }
    if (total === 2) {
      return { nom: "À SUIVRE", classe: "a-suivre" };
    }
    return { nom: "NON ACTIF", classe: "non-actif" };
  };

  /* =====================================================
     CONSTRUCTION DU SUIVI MENSUEL
  ===================================================== */

  const suiviActivite = useMemo(() => {
    const maintenant = new Date();
    const samedis = obtenirSamedisDuMois(maintenant);

    const personnesMap = {};

    personnes.forEach((personne) => {
      const personneId = personne.personneId;
      if (!personneId) return;

      personnesMap[personneId] = {
        personneId: personneId,
        nom: personne.nom || "",
        prenom: personne.prenom || "",
        telephone: personne.telephone || "",
        statut: personne.statut || "",
        departement: personne.departement || "",
        samedis: samedis.map(() => false),
      };
    });

    presences.forEach((presence) => {
      const personneId = presence.personneId;
      if (!personneId || !personnesMap[personneId]) return;

      samedis.forEach((samedi, index) => {
        if (presenceCorrespondAuSamedi(presence, samedi)) {
          personnesMap[personneId].samedis[index] = true;
        }
      });
    });

    return Object.values(personnesMap).map((personne) => {
      const total = personne.samedis.filter(Boolean).length;
      return {
        ...personne,
        total,
        niveau: obtenirNiveauActivite(total),
      };
    });
  }, [presences, personnes]);

  /* =====================================================
     RECHERCHE DANS LE SUIVI D'ACTIVITÉ
  ===================================================== */

  const suiviActiviteFiltre = suiviActivite.filter((personne) => {
    const texteRecherche = recherche.toLowerCase().trim();

    const nomComplet = `${personne.nom} ${personne.prenom}`.toLowerCase();
    const telephone = personne.telephone;
    const personneId = personne.personneId.toLowerCase();

    return (
      nomComplet.includes(texteRecherche) ||
      telephone.includes(texteRecherche) ||
      personneId.includes(texteRecherche)
    );
  });

  /* =====================================================
     STATISTIQUES ACTIVITÉ
  ===================================================== */

  const totalSuperActifs = suiviActivite.filter((personne) => personne.total === 4).length;
  const totalActifs = suiviActivite.filter((personne) => personne.total === 3).length;
  const totalASuivre = suiviActivite.filter((personne) => personne.total === 2).length;
  const totalNonActifs = suiviActivite.filter((personne) => personne.total <= 1).length;

  /* =====================================================
     DONNÉES POUR LE GRAPHIQUE D'ACTIVITÉ
  ===================================================== */

  const donneesActivite = useMemo(() => {
    return [
      { nom: "SUPER ACTIF", valeur: totalSuperActifs, couleur: "#111111" },
      { nom: "ACTIF", valeur: totalActifs, couleur: "#555555" },
      { nom: "À SUIVRE", valeur: totalASuivre, couleur: "#999999" },
      { nom: "NON ACTIF", valeur: totalNonActifs, couleur: "#d5d5d5" },
    ].filter((item) => item.valeur > 0);
  }, [totalSuperActifs, totalActifs, totalASuivre, totalNonActifs]);

  /* =====================================================
     COULEURS POUR LES GRAPHIQUES
  ===================================================== */

  const COULEURS = ["#ff007f", "#76ee59", "#40d0e0", "#0a3663", "#ff6b6b", "#feca57", "#48dbfb"];

  /* =====================================================
     EXPORT EXCEL - PAR SAMEDI
  ===================================================== */

  const exporterExcel = (samediIndex) => {
    setExportEnCours(true);

    try {
      const maintenant = new Date();
      const samedis = obtenirSamedisDuMois(maintenant);
      
      if (samediIndex >= samedis.length) {
        alert("Ce samedi n'existe pas dans le mois en cours.");
        setExportEnCours(false);
        return;
      }

      const samedi = samedis[samediIndex];
      const dateSamedi = samedi.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const presentes = suiviActivite.filter((personne) => {
        return personne.samedis[samediIndex] === true;
      });

      if (presentes.length === 0) {
        alert(`Aucune présence enregistrée pour le samedi ${dateSamedi}`);
        setExportEnCours(false);
        return;
      }

      const donneesExcel = presentes.map((personne, index) => ({
        "#": index + 1,
        "ID": personne.personneId,
        "Nom": personne.nom,
        "Prénom": personne.prenom,
        "Téléphone": personne.telephone,
        "Statut": personne.statut || "-",
        "Département": personne.departement || "-",
        "Samedi": dateSamedi,
        "Présence": "✅ Présent",
      }));

      const resume = {
        "#": "",
        "ID": "",
        "Nom": "",
        "Prénom": "",
        "Téléphone": "",
        "Statut": "",
        "Département": "",
        "Samedi": "TOTAL",
        "Présence": `${presentes.length} personnes`,
      };

      donneesExcel.push(resume);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(donneesExcel);

      ws["!cols"] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Présences");
      
      const nomFichier = `BLOOM_Presences_Samedi_${samediIndex + 1}_${dateSamedi.replace(/\s/g, "_")}.xlsx`;
      XLSX.writeFile(wb, nomFichier);

      alert(`✅ Export Excel réussi !\n📊 ${presentes.length} personnes présentes le ${dateSamedi}`);
    } catch (error) {
      console.error("Erreur lors de l'export Excel :", error);
      alert("❌ Erreur lors de l'export Excel. Vérifie la console.");
    } finally {
      setExportEnCours(false);
    }
  };

  /* =====================================================
     MOIS ACTUEL
  ===================================================== */

  const moisActuel = new Date().toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const samedis = obtenirSamedisDuMois(new Date());

  /* =====================================================
     PAGE DE CONNEXION
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
            <p className="connexion-sous-titre">Veuillez vous identifier pour accéder à l'administration</p>
            
            <form onSubmit={handleConnexion} className="connexion-form">
              <div className="connexion-groupe">
                <label>NOM D'UTILISATEUR</label>
                <input
                  type="text"
                  placeholder="Entrez votre nom"
                  value={nomUtilisateur}
                  onChange={(e) => setNomUtilisateur(e.target.value)}
                  required
                />
              </div>

              <div className="connexion-groupe">
                <label>MOT DE PASSE</label>
                <input
                  type="password"
                  placeholder="Entrez votre mot de passe"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
              </div>

              {erreurConnexion && (
                <div className="connexion-erreur">{erreurConnexion}</div>
              )}

              <button type="submit" className="connexion-bouton">
                SE CONNECTER →
              </button>
            </form>

            <div className="connexion-pied">
              <span>Accès sécurisé</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     RENDU ADMIN
  ===================================================== */

  return (
    <div className="admin-page">

      {/* =================================================
          BARRE LATÉRALE
      ================================================= */}

      <aside className="admin-sidebar">

        <div className="admin-logo">
          BLOOM
          <span>TEAMS ADMIN</span>
        </div>

        <nav className="admin-menu">
          <a 
            href="#dashboard" 
            className={ongletActif === "dashboard" ? "menu-actif" : ""}
            onClick={(e) => { e.preventDefault(); setOngletActif("dashboard"); }}
          >
            <span>▦</span>
            TABLEAU DE BORD
          </a>
          <a 
            href="#statistiques" 
            className={ongletActif === "statistiques" ? "menu-actif" : ""}
            onClick={(e) => { e.preventDefault(); setOngletActif("statistiques"); }}
          >
            <span>📊</span>
            STATISTIQUES
          </a>
        </nav>

        <div className="admin-sidebar-bas">
          <div className="admin-indicateur">
            <span></span>
            FIREBASE CONNECTÉ
          </div>
          <button 
            className="bouton-deconnexion"
            onClick={() => {
              setEstConnecte(false);
              setNomUtilisateur("");
              setMotDePasse("");
            }}
          >
            ← Déconnexion
          </button>
        </div>

      </aside>

      {/* =================================================
          CONTENU PRINCIPAL
      ================================================= */}

      <div className="admin-contenu">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="admin-header">

          <div>
            <p className="admin-sur-titre">BLOOM TEAMS</p>
            <h1>{ongletActif === "dashboard" ? "TABLEAU DE BORD" : "STATISTIQUES"}</h1>
            <p className="admin-description">
              {ongletActif === "dashboard" 
                ? "Suivi des présences et de l'activité des membres."
                : "Analyse visuelle des données avec graphiques et export Excel."}
            </p>
          </div>

          <div className="admin-actions">
            <button
              className="bouton-actualiser"
              onClick={recupererDonnees}
              disabled={chargement}
            >
              ↻ {chargement ? "CHARGEMENT..." : "ACTUALISER"}
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

        {/* =================================================
            ERREUR
        ================================================= */}

        {erreur && <div className="admin-erreur">{erreur}</div>}

        {/* =================================================
            ONGLET : TABLEAU DE BORD
        ================================================= */}

        {ongletActif === "dashboard" && (

          <>

            {/* INTRODUCTION */}
            <section className="admin-introduction" id="dashboard">

              <div>
                <p className="admin-sur-titre">CULTE DU SAMEDI</p>
                <h2>SUIVI DES PRÉSENCES</h2>
                <p>
                  Toutes les informations renseignées dans le formulaire
                  sont récupérées automatiquement depuis Firebase.
                </p>
              </div>

              <div className="date-tableau">
                <span>PERSONNES ENREGISTRÉES</span>
                <strong>{totalPersonnes}</strong>
              </div>

            </section>

            {/* CARTES STATISTIQUES */}
            <section className="cartes-statistiques">

              <div className="carte-statistique" style={{ borderTop: "4px solid #ff007f" }}>
                <span className="icone-statistique">👤</span>
                <div>
                  <p>TOTAL PERSONNES</p>
                  <strong>{totalPersonnes}</strong>
                </div>
              </div>

              <div className="carte-statistique" style={{ borderTop: "4px solid #76ee59" }}>
                <span className="icone-statistique">📋</span>
                <div>
                  <p>TOTAL PRÉSENCES</p>
                  <strong>{totalPresences}</strong>
                </div>
              </div>

              <div className="carte-statistique" style={{ borderTop: "4px solid #40d0e0" }}>
                <span className="icone-statistique">✅</span>
                <div>
                  <p>MEMBRES</p>
                  <strong>{totalMembres}</strong>
                </div>
              </div>

              <div className="carte-statistique" style={{ borderTop: "4px solid #feca57" }}>
                <span className="icone-statistique">❌</span>
                <div>
                  <p>NON-MEMBRES</p>
                  <strong>{totalNonMembres}</strong>
                </div>
              </div>

              <div className="carte-statistique" style={{ borderTop: "4px solid #ff6b6b" }}>
                <span className="icone-statistique">🌟</span>
                <div>
                  <p>NOUVEAUX</p>
                  <strong>{totalNouveaux}</strong>
                </div>
              </div>

            </section>

            {/* OUTILS DE RECHERCHE */}
            <section className="outils-admin" id="presences">

              <div className="recherche-admin">
                <label>RECHERCHER</label>
                <input
                  type="text"
                  placeholder="Nom, prénom, téléphone ou ID (BT-0001)..."
                  value={recherche}
                  onChange={(evenement) => setRecherche(evenement.target.value)}
                />
              </div>

              <div className="filtre-admin">
                <label>STATUT</label>
                <select
                  value={filtreStatut}
                  onChange={(evenement) => setFiltreStatut(evenement.target.value)}
                >
                  <option value="TOUS">TOUS</option>
                  <option value="Oui">MEMBRES</option>
                  <option value="Non">NON-MEMBRES</option>
                  <option value="Nouveau">NOUVEAUX</option>
                </select>
              </div>

            </section>

            {/* TABLEAU DES PRÉSENCES */}
            <section className="section-tableau">

              <div className="titre-tableau">
                <div>
                  <p>PRÉSENCES ENREGISTRÉES</p>
                  <h3>LISTE DES PARTICIPANTS</h3>
                </div>
                <span>
                  {presencesFiltrees.length} résultat
                  {presencesFiltrees.length > 1 ? "s" : ""}
                </span>
              </div>

              {chargement ? (
                <div className="etat-tableau">
                  <div className="chargement">CHARGEMENT DES DONNÉES...</div>
                </div>
              ) : presencesFiltrees.length === 0 ? (
                <div className="etat-tableau">
                  <div className="aucune-donnee">
                    <strong>AUCUNE DONNÉE</strong>
                    <p>Aucun enregistrement ne correspond à ta recherche.</p>
                  </div>
                </div>
              ) : (
                <div className="tableau-wrapper">
                  <table className="tableau-presences">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>ID</th>
                        <th>NOM</th>
                        <th>PRÉNOM</th>
                        <th>TÉLÉPHONE</th>
                        <th>MEMBRE</th>
                        <th>DÉPARTEMENT</th>
                        <th>DATE</th>
                        <th>HEURE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presencesFiltrees.map((personne, index) => (
                        <tr key={personne.id}>
                          <td>{index + 1}</td>
                          <td>
                            <span className="badge-id">{personne.personneId || "-"}</span>
                          </td>
                          <td>
                            <strong>{personne.nom || "-"}</strong>
                          </td>
                          <td>{personne.prenom || "-"}</td>
                          <td>{personne.telephone || "-"}</td>
                          <td>
                            <span
                              className={
                                personne.statut === "Oui"
                                  ? "badge-membre"
                                  : personne.statut === "Nouveau"
                                  ? "badge-nouveau"
                                  : "badge-non-membre"
                              }
                            >
                              {personne.statut === "Oui"
                                ? "MEMBRE"
                                : personne.statut === "Nouveau"
                                ? "NOUVEAU"
                                : "NON-MEMBRE"}
                            </span>
                          </td>
                          <td>{personne.departement || "-"}</td>
                          <td>{personne.date || "-"}</td>
                          <td>{personne.heure || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </section>

            {/* SUIVI DE L'ACTIVITÉ */}
            <section className="section-activite" id="activite">

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
                    <span>À SUIVRE</span>
                  </div>
                  <div style={{ borderBottom: "3px solid #d5d5d5" }}>
                    <strong>{totalNonActifs}</strong>
                    <span>NON ACTIFS</span>
                  </div>
                </div>
              </div>

              {/* LÉGENDE */}
              <div className="legende-activite">
                <span>
                  <b className="point-super-actif"></b>
                  4/4 SUPER ACTIF
                </span>
                <span>
                  <b className="point-actif"></b>
                  3/4 ACTIF
                </span>
                <span>
                  <b className="point-a-suivre"></b>
                  2/4 À SUIVRE
                </span>
                <span>
                  <b className="point-non-actif"></b>
                  0–1/4 NON ACTIF
                </span>
              </div>

              {/* TABLEAU ACTIVITÉ */}
              {suiviActiviteFiltre.length === 0 ? (
                <div className="etat-activite">
                  <strong>AUCUNE PERSONNE</strong>
                  <p>
                    Les personnes apparaîtront automatiquement dès qu'une
                    présence sera enregistrée.
                  </p>
                </div>
              ) : (
                <div className="tableau-activite-wrapper">
                  <table className="tableau-activite">
                    <thead>
                      <tr>
                        <th>PERSONNE</th>
                        {samedis.map((samedi, index) => (
                          <th key={samedi.toISOString()}>
                            SAMEDI {index + 1}
                            <small>{formaterDate(samedi)}</small>
                          </th>
                        ))}
                        <th>TOTAL</th>
                        <th>NIVEAU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suiviActiviteFiltre.map((personne) => (
                        <tr key={personne.personneId}>
                          <td>
                            <div className="personne-activite">
                              <div className="avatar-activite">
                                {(personne.prenom?.charAt(0) || personne.nom?.charAt(0) || "?").toUpperCase()}
                              </div>
                              <div>
                                <strong>
                                  <span className="badge-id-mini">{personne.personneId}</span>
                                  {personne.nom || "-"} {personne.prenom || ""}
                                </strong>
                                <small>{personne.telephone}</small>
                              </div>
                            </div>
                          </td>
                          {personne.samedis.map((present, index) => (
                            <td key={index} className="cellule-samedi">
                              {present ? (
                                <span className="presence-oui">✓</span>
                              ) : (
                                <span className="presence-non">—</span>
                              )}
                            </td>
                          ))}
                          <td>
                            <strong className="total-activite">{personne.total}/4</strong>
                          </td>
                          <td>
                            <span className={`badge-activite ${personne.niveau.classe}`}>
                              {personne.niveau.nom}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </section>

            {/* EXPLICATION */}
            <section className="bloc-explication">
              <div>
                <span>NOUVELLE LOGIQUE</span>
                <h3>IDENTIFICATION PAR PERSONNE ID</h3>
                <p>
                  Chaque personne possède désormais un identifiant unique <strong>BT-XXXX</strong>.
                  Le numéro de téléphone n'est plus utilisé comme identifiant principal.
                  Une même personne peut avoir plusieurs présences sur les 4 samedis du mois.
                  Le niveau d'activité est calculé automatiquement.
                </p>
              </div>

              <div className="statuts-activite">
                <div>
                  <strong>4/4</strong>
                  <span>SUPER ACTIF</span>
                </div>
                <div>
                  <strong>3/4</strong>
                  <span>ACTIF</span>
                </div>
                <div>
                  <strong>2/4</strong>
                  <span>À SUIVRE</span>
                </div>
                <div>
                  <strong>0–1/4</strong>
                  <span>NON ACTIF</span>
                </div>
              </div>
            </section>

          </>

        )}

        {/* =================================================
            ONGLET : STATISTIQUES
        ================================================= */}

        {ongletActif === "statistiques" && (

          <>

            {/* SECTION STATISTIQUES AVEC GRAPHIQUES */}
            <section className="section-statistiques">

              {/* GRAPHIQUE 1 : RÉPARTITION DES STATUTS (PIE CHART) */}
              <div className="grille-graphiques">

                <div className="carte-graphique">
                  <h4>RÉPARTITION DES STATUTS</h4>
                  {statsStatuts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={statsStatuts}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="valeur"
                          label={({ nom, valeur }) => `${nom}: ${valeur}`}
                          labelLine={false}
                        >
                          {statsStatuts.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={[
                                "#ff007f",
                                "#76ee59",
                                "#40d0e0",
                                "#0a3663",
                                "#feca57",
                              ][index % 5]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="aucune-donnee">Aucune donnée disponible</div>
                  )}
                </div>

                {/* GRAPHIQUE 2 : ACTIVITÉ DES MEMBRES (BAR CHART) */}
                <div className="carte-graphique">
                  <h4>NIVEAU D'ACTIVITÉ</h4>
                  {donneesActivite.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={donneesActivite}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nom" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="valeur" fill="#0a3663" radius={[4, 4, 0, 0]}>
                          {donneesActivite.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.couleur} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="aucune-donnee">Aucune donnée disponible</div>
                  )}
                </div>

              </div>

              {/* DEUXIÈME LIGNE DE GRAPHIQUES */}
              <div className="grille-graphiques">

                {/* GRAPHIQUE 3 : ÉVOLUTION DES PRÉSENCES (AREA CHART) */}
                <div className="carte-graphique">
                  <h4>ÉVOLUTION DES PRÉSENCES</h4>
                  {donneesEvolution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={donneesEvolution}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff007f" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ff007f" stopOpacity={0} />
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
                    <div className="aucune-donnee">Aucune donnée disponible</div>
                  )}
                </div>

                {/* GRAPHIQUE 4 : DÉPARTEMENTS (BAR CHART) */}
                <div className="carte-graphique">
                  <h4>RÉPARTITION PAR DÉPARTEMENT</h4>
                  {statsDepartements.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={statsDepartements}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="nom" type="category" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="valeur" fill="#40d0e0" radius={[0, 4, 4, 0]}>
                          {statsDepartements.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COULEURS[index % COULEURS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="aucune-donnee">Aucune donnée disponible</div>
                  )}
                </div>

              </div>

            </section>

            {/* BOUTONS D'EXPORT EXCEL */}
            <section className="section-export">
              <div className="titre-export">
                <p className="admin-sur-titre">EXPORT</p>
                <h3>📥 EXPORTER LES PRÉSENCES PAR SAMEDI</h3>
                <p>Exporte la liste des personnes présentes pour chaque samedi du mois.</p>
              </div>

              <div className="boutons-export">
                {samedis.map((samedi, index) => {
                  const dateFormatee = samedi.toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  });
                  const nbPresent = suiviActivite.filter((p) => p.samedis[index]).length;

                  return (
                    <button
                      key={index}
                      className="bouton-export"
                      onClick={() => exporterExcel(index)}
                      disabled={exportEnCours || nbPresent === 0}
                      style={{
                        background: nbPresent > 0 ? "#0a3663" : "#ccc",
                        cursor: nbPresent > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      <span className="icon-export">📊</span>
                      <div>
                        <strong>Samedi {index + 1}</strong>
                        <small>{dateFormatee} • {nbPresent} présent(s)</small>
                      </div>
                      <span className="arrow-export">→</span>
                    </button>
                  );
                })}
              </div>
            </section>

          </>

        )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="admin-footer">
          <span>BLOOM TEAMS</span>
          <span>ADMINISTRATION</span>
          <span>© 2026</span>
        </footer>

      </div>

    </div>
  );
}

export default Admin;