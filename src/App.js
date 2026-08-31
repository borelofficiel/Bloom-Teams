import React, { useEffect, useState } from "react";
import "./App.css";
import Admin from "./Admin";

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import db from "./firebase";

/* =========================================================
   PHOTOS
========================================================= */

const photos = [
  "/images/1.jpeg",
  "/images/2.jpeg",
  "/images/3.jpeg",
  "/images/4.jpeg",
  "/images/5.jpeg",
  "/images/6.jpeg",
  "/images/7.jpeg",
];

/* =========================================================
   APPLICATION
========================================================= */

function App() {

  /* =======================================================
     VÉRIFICATION DE LA PAGE ADMIN
  ======================================================= */

  const [pageActuelle, setPageActuelle] = useState(
    window.location.hash === "#admin" ? "admin" : "accueil"
  );

  useEffect(() => {
    const changerPage = () => {
      if (window.location.hash === "#admin") {
        setPageActuelle("admin");
      } else {
        setPageActuelle("accueil");
      }
    };

    window.addEventListener("hashchange", changerPage);

    return () => {
      window.removeEventListener("hashchange", changerPage);
    };
  }, []);

  /* =======================================================
     GALERIE
  ======================================================= */

  const [photoActuelle, setPhotoActuelle] = useState(0);

  /* =======================================================
     FORMULAIRE
  ======================================================= */

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [statut, setStatut] = useState("");
  const [departement, setDepartement] = useState("");

  const [formulaireEnvoye, setFormulaireEnvoye] = useState(false);

  /* =======================================================
     FIREBASE
  ======================================================= */

  const [enregistrementEnCours, setEnregistrementEnCours] =
    useState(false);

  const [erreurEnregistrement, setErreurEnregistrement] =
    useState("");

  /* =========================================================
     DÉFILEMENT GALERIE
  ========================================================= */

  useEffect(() => {
    const defilement = setInterval(() => {
      setPhotoActuelle((anciennePhoto) => {
        if (anciennePhoto === photos.length - 1) {
          return 0;
        }

        return anciennePhoto + 1;
      });
    }, 4500);

    return () => clearInterval(defilement);
  }, []);

  /* =========================================================
     PHOTO PRÉCÉDENTE
  ========================================================= */

  const photoPrecedente = () => {
    setPhotoActuelle((anciennePhoto) => {
      if (anciennePhoto === 0) {
        return photos.length - 1;
      }

      return anciennePhoto - 1;
    });
  };

  /* =========================================================
     PHOTO SUIVANTE
  ========================================================= */

  const photoSuivante = () => {
    setPhotoActuelle((anciennePhoto) => {
      if (anciennePhoto === photos.length - 1) {
        return 0;
      }

      return anciennePhoto + 1;
    });
  };

  /* =========================================================
     ENVOI DU FORMULAIRE
  ========================================================= */

  const envoyerFormulaire = async (evenement) => {
    evenement.preventDefault();

    setErreurEnregistrement("");
    setEnregistrementEnCours(true);

    try {
      const maintenant = new Date();

      const datePresence =
        maintenant.toLocaleDateString("fr-FR");

      const heurePresence =
        maintenant.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });

      await addDoc(collection(db, "presences"), {
        nom: nom.trim().toUpperCase(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
        statut: statut,
        departement: departement,
        date: datePresence,
        heure: heurePresence,
        dateEnregistrement: serverTimestamp(),
      });

      console.log("Présence enregistrée avec succès.");

      setFormulaireEnvoye(true);

    } catch (erreur) {
      console.error(
        "Erreur lors de l'enregistrement :",
        erreur
      );

      setErreurEnregistrement(
        "Impossible d'enregistrer ta présence. Vérifie ta connexion Internet et réessaie."
      );

    } finally {
      setEnregistrementEnCours(false);
    }
  };

  /* =========================================================
     NOUVEAU REMPLISSAGE
  ========================================================= */

  const nouveauRemplissage = () => {
    setNom("");
    setPrenom("");
    setTelephone("");
    setStatut("");
    setDepartement("");
    setFormulaireEnvoye(false);
    setErreurEnregistrement("");
  };

  /* =========================================================
     AFFICHAGE ADMIN
  ========================================================= */

  if (pageActuelle === "admin") {
    return <Admin />;
  }

  /* =========================================================
     AFFICHAGE SITE PRINCIPAL
  ========================================================= */

  return (
    <div className="application">

      {/* =====================================================
          EN-TÊTE
      ===================================================== */}

      <header className="en-tete">

        <a href="#accueil" className="logo">
          <img
            src="/images/LOGO.PNG"
            alt="BLOOM AVF"
          />
        </a>

        <nav className="navigation">

          <a href="#accueil">
            ACCUEIL
          </a>

          <a href="#apropos">
            À PROPOS
          </a>

          <a href="#galerie">
            GALERIE
          </a>

          <a href="#presence">
            PRÉSENCE
          </a>

        </nav>

        <a
          href="#presence"
          className="bouton-en-tête"
        >
          PRÉSENCE <span>↗</span>
        </a>

      </header>

      {/* =====================================================
          CONTENU
      ===================================================== */}

      <main>

        {/* ===================================================
            ACCUEIL
        =================================================== */}

        <section
          className="accueil"
          id="accueil"
        >

          <div className="accueil-contenu">

            <div className="autocollant">
              BLOOM AVF
            </div>

            <p className="petite-etiquette">
              ASSEMBLÉE VIE FRUCTUEUSE
            </p>

            <h1>
              BLOOM
              <br />
              <span>TEAMS</span>
            </h1>

            <p className="description-accueil">
              Une famille. Une vision. Une génération
              qui grandit, sert et porte du fruit ensemble.
            </p>

            <a
              href="#presence"
              className="bouton-principal"
            >
              RENSEIGNER MA PRÉSENCE
              <span>→</span>
            </a>

          </div>

          {/* GALERIE PRINCIPALE */}

          <div className="galerie-accueil">

            <div className="forme-magenta"></div>

            <div className="forme-cyan"></div>

            <div className="photo-principale">

              <img
                src={photos[photoActuelle]}
                alt={`Moment BLOOM ${photoActuelle + 1}`}
              />

            </div>

            <div className="controle-galerie">

              <button
                onClick={photoPrecedente}
                aria-label="Photo précédente"
              >
                ←
              </button>

              <span>
                {String(photoActuelle + 1).padStart(2, "0")}
                {" / "}
                {String(photos.length).padStart(2, "0")}
              </span>

              <button
                onClick={photoSuivante}
                aria-label="Photo suivante"
              >
                →
              </button>

            </div>

          </div>

        </section>

        {/* ===================================================
            BANDE DÉFILANTE
        =================================================== */}

        <div className="bande-defilante">

          <div className="contenu-defilant">

            <span>BLOOM</span>
            <b>✦</b>

            <span>GRANDIR</span>
            <b>✦</b>

            <span>SERVIR</span>
            <b>✦</b>

            <span>PORTER DU FRUIT</span>
            <b>✦</b>

            <span>BLOOM</span>
            <b>✦</b>

            <span>GRANDIR</span>
            <b>✦</b>

            <span>SERVIR</span>
            <b>✦</b>

            <span>PORTER DU FRUIT</span>
            <b>✦</b>

          </div>

        </div>

        {/* ===================================================
            À PROPOS
        =================================================== */}

        <section
          className="a-propos"
          id="apropos"
        >

          <div className="numero-section">
            01
          </div>

          <div className="a-propos-contenu">

            <p className="petite-etiquette">
              NOTRE FAMILLE
            </p>

            <h2>
              ASSEMBLEE VIE FRUCTUEUSE
              <br />
              <span>BLOOM.</span>
            </h2>

            <p className="texte-a-propos">
              BLOOM est un espace où chaque personne compte.
              Nous avançons ensemble dans une même vision,
              avec l'envie de grandir, de servir et de faire
              la différence.
            </p>

            <div className="etiquettes">

              <span>FOI</span>
              <span>FAMILLE</span>
              <span>SERVICE</span>

            </div>

          </div>

          <div className="symbole">
            ✦
          </div>

        </section>

        {/* ===================================================
            GALERIE
        =================================================== */}

        <section
          className="section-galerie"
          id="galerie"
        >

          <div className="en-tete-galerie">

            <div>

              <p className="petite-etiquette">
                NOS MOMENTS
              </p>

              <h2>
                CHURCH
                <br />
                <span>GALERIE</span>
              </h2>

            </div>

            <div className="autocollant-galerie">

              <strong>07</strong>

              PHOTOS
              <br />

              BLOOM

            </div>

          </div>

          <div className="grille-galerie">

            {photos.map((photo, index) => (

              <div
                className={
                  index === 0
                    ? "image-galerie grande"
                    : "image-galerie"
                }
                key={photo}
              >

                <img
                  src={photo}
                  alt={`Galerie BLOOM ${index + 1}`}
                />

                <div className="legende-image">

                  <span>
                    BLOOM
                  </span>

                  <span>
                    0{index + 1}
                  </span>

                </div>

              </div>

            ))}

          </div>

        </section>

        {/* ===================================================
            PRÉSENCE
        =================================================== */}

        <section
          className="section-presence"
          id="presence"
        >

          {/* PARTIE GAUCHE */}

          <div className="introduction-presence">

            <div className="numero-section">
              02
            </div>

            <p className="petite-etiquette">
              CULTE DU SAMEDI
            </p>

            <h2>
              BLOOM
              <br />
              <span>TEAMS</span>
            </h2>

            <p className="texte-presence">
              Chaque samedi, nous prenons le temps
              de nous retrouver, de grandir ensemble
              et de vivre pleinement notre famille.
            </p>

            <div className="decoration-formulaire">
              1 CULTE = 1 PRÉSENCE
            </div>

          </div>

          {/* PARTIE DROITE */}

          <div className="conteneur-formulaire">

            {!formulaireEnvoye ? (

              <form onSubmit={envoyerFormulaire}>

                {/* INFORMATIONS */}

                <div className="bloc-formulaire">

                  <div className="titre-bloc">

                    <span>
                      01
                    </span>

                    TES INFORMATIONS

                  </div>

                  <div className="ligne-champs">

                    <div className="groupe-formulaire">

                      <label htmlFor="nom">
                        NOM
                      </label>

                      <input
                        id="nom"
                        type="text"
                        placeholder="Ton nom"
                        value={nom}
                        onChange={(evenement) =>
                          setNom(evenement.target.value)
                        }
                        required
                      />

                    </div>

                    <div className="groupe-formulaire">

                      <label htmlFor="prenom">
                        PRÉNOM
                      </label>

                      <input
                        id="prenom"
                        type="text"
                        placeholder="Ton prénom"
                        value={prenom}
                        onChange={(evenement) =>
                          setPrenom(evenement.target.value)
                        }
                        required
                      />

                    </div>

                  </div>

                  <div className="groupe-formulaire">

                    <label htmlFor="telephone">
                      NUMÉRO DE TÉLÉPHONE
                    </label>

                    <input
                      id="telephone"
                      type="tel"
                      placeholder="Ex : 07 00 00 00 00"
                      value={telephone}
                      onChange={(evenement) =>
                        setTelephone(evenement.target.value)
                      }
                      required
                    />

                  </div>

                </div>

                {/* MEMBRE */}

                <div className="bloc-formulaire">

                  <div className="titre-bloc">

                    <span>
                      02
                    </span>

                    ES-TU MEMBRE ?

                  </div>

                  <div className="choix-horizontal">

                    <label className="choix">

                      <input
                        type="radio"
                        name="statut"
                        value="Oui"
                        checked={statut === "Oui"}
                        onChange={(evenement) =>
                          setStatut(evenement.target.value)
                        }
                        required
                      />

                      <span>

                        <strong>
                          OUI
                        </strong>

                        <small>
                          Je suis membre
                        </small>

                      </span>

                    </label>

                    <label className="choix">

                      <input
                        type="radio"
                        name="statut"
                        value="Non"
                        checked={statut === "Non"}
                        onChange={(evenement) =>
                          setStatut(evenement.target.value)
                        }
                      />

                      <span>

                        <strong>
                          NON
                        </strong>

                        <small>
                          Je ne suis pas membre
                        </small>

                      </span>

                    </label>

                    <label className="choix">

                      <input
                        type="radio"
                        name="statut"
                        value="Nouveau"
                        checked={statut === "Nouveau"}
                        onChange={(evenement) =>
                          setStatut(evenement.target.value)
                        }
                      />

                      <span>

                        <strong>
                          NOUVEAU
                        </strong>

                        <small>
                          C'est ma première fois
                        </small>

                      </span>

                    </label>

                  </div>

                </div>

                {/* DÉPARTEMENT */}

                <div className="bloc-formulaire">

                  <div className="titre-bloc">

                    <span>
                      03
                    </span>

                    TON DÉPARTEMENT

                  </div>

                  <div className="choix-departements">

                    {[
                      "ACCUEIL",
                      "LOUANGE",
                      "COMMUNICATION",
                      "ADN",
                      "JEUNESSE",
                      "AUTRE",
                    ].map((nomDepartement) => (

                      <label
                        className="choix"
                        key={nomDepartement}
                      >

                        <input
                          type="radio"
                          name="departement"
                          value={nomDepartement}
                          checked={
                            departement === nomDepartement
                          }
                          onChange={(evenement) =>
                            setDepartement(
                              evenement.target.value
                            )
                          }
                          required
                        />

                        <span>
                          {nomDepartement}
                        </span>

                      </label>

                    ))}

                  </div>

                </div>

                {/* ERREUR */}

                {erreurEnregistrement && (

                  <div className="message-erreur">
                    {erreurEnregistrement}
                  </div>

                )}

                {/* BOUTON */}

                <button
                  type="submit"
                  className="bouton-envoi"
                  disabled={enregistrementEnCours}
                >

                  <span>

                    {enregistrementEnCours
                      ? "ENREGISTREMENT..."
                      : "ENREGISTRER MA PRÉSENCE"}

                  </span>

                  <strong>
                    →
                  </strong>

                </button>

              </form>

            ) : (

              /* MESSAGE SUCCÈS */

              <div className="message-succes">

                <div className="icone-succes">
                  ✓
                </div>

                <p className="petite-etiquette">
                  PRÉSENCE ENREGISTRÉE
                </p>

                <h3>
                  MERCI
                  <br />

                  <span>
                    {prenom.toUpperCase()}
                  </span>

                </h3>

                <p>
                  Ta présence a bien été prise en compte.
                  À très bientôt pour le prochain culte.
                </p>

                <button
                  className="bouton-secondaire"
                  onClick={nouveauRemplissage}
                >
                  NOUVELLE PRÉSENCE
                </button>

              </div>

            )}

          </div>

        </section>

      </main>

      {/* =====================================================
          PIED DE PAGE
      ===================================================== */}

      <footer className="pied-page">

        <div className="motif-pied">
          BLOOM
        </div>

        <div className="contenu-pied">

          <div className="logo-pied">
            BLOOM
          </div>

          <p>
            UNE FAMILLE.
            <br />
            UNE VISION.
            <br />
            UNE GÉNÉRATION.
          </p>

        </div>

        <div className="bas-pied">

          <span>
            BLOOM AVF
          </span>

          <span>
            BLOOM TEAMS
          </span>

          <span>
            © 2026
          </span>

        </div>

      </footer>

    </div>
  );
}

export default App;