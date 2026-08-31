import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import db from "./firebase";
import "./Admin.css";

function Admin() {
  /* =====================================================
     DONNÉES FIREBASE
  ===================================================== */

  const [presences, setPresences] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  /* =====================================================
     FILTRES
  ===================================================== */

  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("TOUS");

  /* =====================================================
     RÉCUPÉRATION DES PRÉSENCES
  ===================================================== */

  const recupererPresences = async () => {
    setChargement(true);
    setErreur("");

    try {
      const referencePresences = collection(db, "presences");

      const requete = query(
        referencePresences,
        orderBy("dateEnregistrement", "desc")
      );

      const resultat = await getDocs(requete);

      const donnees = resultat.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));

      setPresences(donnees);

      console.log("Présences récupérées :", donnees);
    } catch (erreurFirebase) {
      console.error(
        "Erreur lors de la récupération :",
        erreurFirebase
      );

      setErreur(
        "Impossible de récupérer les données depuis Firebase."
      );
    } finally {
      setChargement(false);
    }
  };

  /* =====================================================
     CHARGEMENT INITIAL
  ===================================================== */

  useEffect(() => {
    recupererPresences();
  }, []);

  /* =====================================================
     STATISTIQUES GÉNÉRALES
  ===================================================== */

  const totalPresences = presences.length;

  const totalMembres = presences.filter(
    (personne) => personne.statut === "Oui"
  ).length;

  const totalNonMembres = presences.filter(
    (personne) => personne.statut === "Non"
  ).length;

  const totalNouveaux = presences.filter(
    (personne) => personne.statut === "Nouveau"
  ).length;

  /* =====================================================
     RECHERCHE + FILTRE
  ===================================================== */

  const presencesFiltrees = presences.filter((personne) => {
    const texteRecherche = recherche
      .toLowerCase()
      .trim();

    const nomComplet =
      `${personne.nom || ""} ${personne.prenom || ""}`
        .toLowerCase();

    const telephone =
      personne.telephone || "";

    const correspondRecherche =
      nomComplet.includes(texteRecherche) ||
      telephone.includes(texteRecherche);

    const correspondStatut =
      filtreStatut === "TOUS" ||
      personne.statut === filtreStatut;

    return (
      correspondRecherche &&
      correspondStatut
    );
  });

  /* =====================================================
     NORMALISATION DU TÉLÉPHONE
     
     Exemple :
     "07 12 34 56 78"
     devient
     "0712345678"
  ===================================================== */

  const normaliserTelephone = (telephone) => {
    return String(telephone || "")
      .replace(/\D/g, "")
      .trim();
  };

  /* =====================================================
     NORMALISATION DU NOM
     
     Permet de comparer les noms même avec :
     - majuscules
     - minuscules
     - accents
  ===================================================== */

  const normaliserTexte = (texte) => {
    return String(texte || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  /* =====================================================
     DÉTERMINER LES 4 SAMEDIS DU MOIS
  ===================================================== */

  const obtenirSamedisDuMois = (date) => {
    const annee = date.getFullYear();
    const mois = date.getMonth();

    const samedis = [];

    const premierJour = new Date(
      annee,
      mois,
      1
    );

    const dernierJour = new Date(
      annee,
      mois + 1,
      0
    );

    for (
      let jour = 1;
      jour <= dernierJour.getDate();
      jour++
    ) {
      const dateJour = new Date(
        annee,
        mois,
        jour
      );

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
    return date.toLocaleDateString(
      "fr-FR",
      {
        day: "2-digit",
        month: "2-digit",
      }
    );
  };

  /* =====================================================
     VÉRIFIER SI UNE PRÉSENCE CORRESPOND À UN SAMEDI
     
     On utilise en priorité dateEnregistrement Firebase.
  ===================================================== */

  const presenceCorrespondAuSamedi = (
    presence,
    samedi
  ) => {
    if (!presence.dateEnregistrement) {
      return false;
    }

    let datePresence;

    try {
      if (
        typeof presence.dateEnregistrement.toDate ===
        "function"
      ) {
        datePresence =
          presence.dateEnregistrement.toDate();
      } else {
        datePresence = new Date(
          presence.dateEnregistrement
        );
      }
    } catch {
      return false;
    }

    if (
      Number.isNaN(datePresence.getTime())
    ) {
      return false;
    }

    return (
      datePresence.getFullYear() ===
        samedi.getFullYear() &&
      datePresence.getMonth() ===
        samedi.getMonth() &&
      datePresence.getDate() ===
        samedi.getDate()
    );
  };

  /* =====================================================
     CALCUL DU NIVEAU D'ACTIVITÉ
  ===================================================== */

  const obtenirNiveauActivite = (total) => {
    if (total === 4) {
      return {
        nom: "SUPER ACTIF",
        classe: "super-actif",
      };
    }

    if (total === 3) {
      return {
        nom: "ACTIF",
        classe: "actif",
      };
    }

    if (total === 2) {
      return {
        nom: "À SUIVRE",
        classe: "a-suivre",
      };
    }

    return {
      nom: "NON ACTIF",
      classe: "non-actif",
    };
  };

  /* =====================================================
     CONSTRUCTION DU SUIVI MENSUEL
  ===================================================== */

  const suiviActivite = useMemo(() => {
    const maintenant = new Date();

    const samedis =
      obtenirSamedisDuMois(maintenant);

    const personnes = {};

    presences.forEach((presence) => {
      const telephone =
        normaliserTelephone(
          presence.telephone
        );

      /*
       * Le téléphone est utilisé comme identifiant.
       */

      if (!telephone) {
        return;
      }

      if (!personnes[telephone]) {
        personnes[telephone] = {
          telephone,
          nom: presence.nom || "",
          prenom: presence.prenom || "",
          statut: presence.statut || "",
          departement:
            presence.departement || "",
          samedis: samedis.map(() => false),
        };
      }

      samedis.forEach(
        (samedi, index) => {
          if (
            presenceCorrespondAuSamedi(
              presence,
              samedi
            )
          ) {
            personnes[telephone].samedis[
              index
            ] = true;
          }
        }
      );
    });

    return Object.values(personnes).map(
      (personne) => {
        const total = personne.samedis.filter(
          Boolean
        ).length;

        return {
          ...personne,
          total,
          niveau:
            obtenirNiveauActivite(total),
        };
      }
    );
  }, [presences]);

  /* =====================================================
     RECHERCHE DANS LE SUIVI D'ACTIVITÉ
  ===================================================== */

  const suiviActiviteFiltre =
    suiviActivite.filter((personne) => {
      const texteRecherche =
        recherche
          .toLowerCase()
          .trim();

      const nomComplet =
        `${personne.nom} ${personne.prenom}`
          .toLowerCase();

      const telephone =
        personne.telephone;

      return (
        nomComplet.includes(
          texteRecherche
        ) ||
        telephone.includes(
          normaliserTelephone(
            texteRecherche
          )
        )
      );
    });

  /* =====================================================
     STATISTIQUES ACTIVITÉ
  ===================================================== */

  const totalSuperActifs =
    suiviActivite.filter(
      (personne) =>
        personne.total === 4
    ).length;

  const totalActifs =
    suiviActivite.filter(
      (personne) =>
        personne.total === 3
    ).length;

  const totalASuivre =
    suiviActivite.filter(
      (personne) =>
        personne.total === 2
    ).length;

  const totalNonActifs =
    suiviActivite.filter(
      (personne) =>
        personne.total <= 1
    ).length;

  /* =====================================================
     MOIS ACTUEL
  ===================================================== */

  const moisActuel =
    new Date().toLocaleDateString(
      "fr-FR",
      {
        month: "long",
        year: "numeric",
      }
    );

  /* =====================================================
     AFFICHAGE
  ===================================================== */

  return (
    <div className="admin-page">

      {/* =================================================
          BARRE LATÉRALE
      ================================================= */}

      <aside className="admin-sidebar">

        <div className="admin-logo">
          BLOOM

          <span>
            TEAMS ADMIN
          </span>
        </div>

        <nav className="admin-menu">

          <a
            href="#tableau"
            className="menu-actif"
          >
            <span>▦</span>
            TABLEAU DE BORD
          </a>

          <a href="#presences">
            <span>✓</span>
            PRÉSENCES
          </a>

          <a href="#activite">
            <span>◷</span>
            ACTIVITÉ
          </a>

        </nav>

        <div className="admin-sidebar-bas">

          <div className="admin-indicateur">

            <span></span>

            FIREBASE CONNECTÉ

          </div>

          <a
            href="#accueil"
            className="retour-site"
          >
            ← Retour au site
          </a>

        </div>

      </aside>


      {/* =================================================
          CONTENU ADMIN
      ================================================= */}

      <div className="admin-contenu">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="admin-header">

          <div>

            <p className="admin-sur-titre">
              BLOOM TEAMS
            </p>

            <h1>
              TABLEAU DE BORD
            </h1>

            <p className="admin-description">
              Suivi des présences et de
              l'activité des membres.
            </p>

          </div>

          <div className="admin-actions">

            <button
              className="bouton-actualiser"
              onClick={
                recupererPresences
              }
              disabled={chargement}
            >
              ↻{" "}
              {chargement
                ? "CHARGEMENT..."
                : "ACTUALISER"}
            </button>

            <div className="profil-admin">

              <div className="avatar-admin">
                A
              </div>

              <div>

                <strong>
                  ADMIN
                </strong>

                <small>
                  Administration
                </small>

              </div>

            </div>

          </div>

        </div>


        {/* =================================================
            INTRODUCTION
        ================================================= */}

        <section
          className="admin-introduction"
          id="tableau"
        >

          <div>

            <p className="admin-sur-titre">
              CULTE DU SAMEDI
            </p>

            <h2>
              SUIVI DES PRÉSENCES
            </h2>

            <p>
              Toutes les informations
              renseignées dans le formulaire
              sont récupérées automatiquement
              depuis Firebase.
            </p>

          </div>

          <div className="date-tableau">

            <span>
              PRÉSENCES ENREGISTRÉES
            </span>

            <strong>
              {totalPresences}
            </strong>

          </div>

        </section>


        {/* =================================================
            ERREUR
        ================================================= */}

        {erreur && (

          <div className="admin-erreur">
            {erreur}
          </div>

        )}


        {/* =================================================
            CARTES STATISTIQUES
        ================================================= */}

        <section className="cartes-statistiques">

          <div className="carte-statistique">

            <span className="icone-statistique">
              01
            </span>

            <div>

              <p>
                TOTAL PRÉSENCES
              </p>

              <strong>
                {totalPresences}
              </strong>

            </div>

          </div>


          <div className="carte-statistique">

            <span className="icone-statistique">
              02
            </span>

            <div>

              <p>
                MEMBRES
              </p>

              <strong>
                {totalMembres}
              </strong>

            </div>

          </div>


          <div className="carte-statistique">

            <span className="icone-statistique">
              03
            </span>

            <div>

              <p>
                NON-MEMBRES
              </p>

              <strong>
                {totalNonMembres}
              </strong>

            </div>

          </div>


          <div className="carte-statistique">

            <span className="icone-statistique">
              04
            </span>

            <div>

              <p>
                NOUVEAUX
              </p>

              <strong>
                {totalNouveaux}
              </strong>

            </div>

          </div>

        </section>


        {/* =================================================
            OUTILS DE RECHERCHE
        ================================================= */}

        <section
          className="outils-admin"
          id="presences"
        >

          <div className="recherche-admin">

            <label>
              RECHERCHER
            </label>

            <input
              type="text"
              placeholder="Nom, prénom ou téléphone..."
              value={recherche}
              onChange={(evenement) =>
                setRecherche(
                  evenement.target.value
                )
              }
            />

          </div>


          <div className="filtre-admin">

            <label>
              STATUT
            </label>

            <select
              value={filtreStatut}
              onChange={(evenement) =>
                setFiltreStatut(
                  evenement.target.value
                )
              }
            >

              <option value="TOUS">
                TOUS
              </option>

              <option value="Oui">
                MEMBRES
              </option>

              <option value="Non">
                NON-MEMBRES
              </option>

              <option value="Nouveau">
                NOUVEAUX
              </option>

            </select>

          </div>

        </section>


        {/* =================================================
            TABLEAU DES PRÉSENCES
        ================================================= */}

        <section className="section-tableau">

          <div className="titre-tableau">

            <div>

              <p>
                PRÉSENCES ENREGISTRÉES
              </p>

              <h3>
                LISTE DES PARTICIPANTS
              </h3>

            </div>

            <span>
              {presencesFiltrees.length} résultat
              {presencesFiltrees.length > 1
                ? "s"
                : ""}
            </span>

          </div>


          {chargement ? (

            <div className="etat-tableau">

              <div className="chargement">
                CHARGEMENT DES DONNÉES...
              </div>

            </div>

          ) : presencesFiltrees.length === 0 ? (

            <div className="etat-tableau">

              <div className="aucune-donnee">

                <strong>
                  AUCUNE DONNÉE
                </strong>

                <p>
                  Aucun enregistrement ne
                  correspond à ta recherche.
                </p>

              </div>

            </div>

          ) : (

            <div className="tableau-wrapper">

              <table className="tableau-presences">

                <thead>

                  <tr>

                    <th>#</th>

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

                  {presencesFiltrees.map(
                    (personne, index) => (

                      <tr
                        key={
                          personne.id
                        }
                      >

                        <td>
                          {index + 1}
                        </td>

                        <td>
                          <strong>
                            {personne.nom ||
                              "-"}
                          </strong>
                        </td>

                        <td>
                          {personne.prenom ||
                            "-"}
                        </td>

                        <td>
                          {personne.telephone ||
                            "-"}
                        </td>

                        <td>

                          <span
                            className={
                              personne.statut ===
                              "Oui"
                                ? "badge membre"
                                : personne.statut ===
                                  "Nouveau"
                                ? "badge nouveau"
                                : "badge non-membre"
                            }
                          >

                            {personne.statut ===
                            "Oui"
                              ? "MEMBRE"
                              : personne.statut ===
                                "Nouveau"
                              ? "NOUVEAU"
                              : "NON-MEMBRE"}

                          </span>

                        </td>

                        <td>
                          {personne.departement ||
                            "-"}
                        </td>

                        <td>
                          {personne.date ||
                            "-"}
                        </td>

                        <td>
                          {personne.heure ||
                            "-"}
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* =================================================
            SUIVI DE L'ACTIVITÉ
        ================================================= */}

        <section
          className="section-activite"
          id="activite"
        >

          <div className="titre-activite">

            <div>

              <p>
                SUIVI MENSUEL
              </p>

              <h2>
                SUIVI DE L'ACTIVITÉ
              </h2>

              <span>
                {moisActuel}
              </span>

            </div>

            <div className="resume-activite">

              <div>
                <strong>
                  {totalSuperActifs}
                </strong>

                <span>
                  SUPER ACTIFS
                </span>
              </div>

              <div>
                <strong>
                  {totalActifs}
                </strong>

                <span>
                  ACTIFS
                </span>
              </div>

              <div>
                <strong>
                  {totalASuivre}
                </strong>

                <span>
                  À SUIVRE
                </span>
              </div>

              <div>
                <strong>
                  {totalNonActifs}
                </strong>

                <span>
                  NON ACTIFS
                </span>
              </div>

            </div>

          </div>


          {/* =================================================
              LÉGENDE
          ================================================= */}

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


          {/* =================================================
              TABLEAU ACTIVITÉ
          ================================================= */}

          {suiviActiviteFiltre.length ===
          0 ? (

            <div className="etat-activite">

              <strong>
                AUCUNE PERSONNE
              </strong>

              <p>
                Les personnes apparaîtront
                automatiquement dès qu'une
                présence sera enregistrée.
              </p>

            </div>

          ) : (

            <div className="tableau-activite-wrapper">

              <table className="tableau-activite">

                <thead>

                  <tr>

                    <th>
                      PERSONNE
                    </th>

                    {obtenirSamedisDuMois(
                      new Date()
                    ).map(
                      (samedi, index) => (

                        <th
                          key={
                            samedi.toISOString()
                          }
                        >

                          SAMEDI {index + 1}

                          <small>
                            {formaterDate(
                              samedi
                            )}
                          </small>

                        </th>

                      )
                    )}

                    <th>
                      TOTAL
                    </th>

                    <th>
                      NIVEAU
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {suiviActiviteFiltre.map(
                    (personne) => (

                      <tr
                        key={
                          personne.telephone
                        }
                      >

                        <td>

                          <div className="personne-activite">

                            <div className="avatar-activite">

                              {(
                                personne.prenom?.charAt(
                                  0
                                ) ||
                                personne.nom?.charAt(
                                  0
                                ) ||
                                "?"
                              ).toUpperCase()}

                            </div>

                            <div>

                              <strong>
                                {personne.nom ||
                                  "-"}{" "}
                                {personne.prenom ||
                                  ""}
                              </strong>

                              <small>
                                {
                                  personne.telephone
                                }
                              </small>

                            </div>

                          </div>

                        </td>


                        {personne.samedis.map(
                          (
                            present,
                            index
                          ) => (

                            <td
                              key={
                                index
                              }
                              className="cellule-samedi"
                            >

                              {present ? (

                                <span className="presence-oui">
                                  ✓
                                </span>

                              ) : (

                                <span className="presence-non">
                                  —
                                </span>

                              )}

                            </td>

                          )
                        )}


                        <td>

                          <strong className="total-activite">
                            {personne.total}/4
                          </strong>

                        </td>


                        <td>

                          <span
                            className={`badge-activite ${personne.niveau.classe}`}
                          >

                            {personne.niveau.nom}

                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* =================================================
            EXPLICATION
        ================================================= */}

        <section className="bloc-explication">

          <div>

            <span>
              LOGIQUE DU SUIVI
            </span>

            <h3>
              UNE PRÉSENCE PAR SAMEDI
            </h3>

            <p>
              Une personne est identifiée
              principalement grâce à son numéro
              de téléphone. Une seule présence
              est comptabilisée par samedi.
              Le niveau d'activité est calculé
              automatiquement sur les quatre
              samedis du mois.
            </p>

          </div>

          <div className="statuts-activite">

            <div>
              <strong>
                4/4
              </strong>

              <span>
                SUPER ACTIF
              </span>
            </div>

            <div>
              <strong>
                3/4
              </strong>

              <span>
                ACTIF
              </span>
            </div>

            <div>
              <strong>
                2/4
              </strong>

              <span>
                À SUIVRE
              </span>
            </div>

            <div>
              <strong>
                0–1/4
              </strong>

              <span>
                NON ACTIF
              </span>
            </div>

          </div>

        </section>


        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="admin-footer">

          <span>
            BLOOM TEAMS
          </span>

          <span>
            ADMINISTRATION
          </span>

          <span>
            © 2026
          </span>

        </footer>

      </div>

    </div>
  );
}

export default Admin;