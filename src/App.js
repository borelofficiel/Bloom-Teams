import React, { useEffect, useState } from "react";
import "./App.css";
import Admin from "./Admin";

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  runTransaction,
  doc,
  onSnapshot,
} from "firebase/firestore";
import db from "./firebase";

/* =========================================================
   PHOTOS
========================================================= */

const photos = [
  process.env.PUBLIC_URL + "/images/1.jpeg",
  process.env.PUBLIC_URL + "/images/2.jpeg",
  process.env.PUBLIC_URL + "/images/3.jpeg",
  process.env.PUBLIC_URL + "/images/4.jpeg",
  process.env.PUBLIC_URL + "/images/5.jpeg",
  process.env.PUBLIC_URL + "/images/6.jpeg",
  process.env.PUBLIC_URL + "/images/7.jpeg",
];

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
    .replace(/[\s\-'’]/g, "");
};

const normaliserTelephone = (tel) => {
  let chiffres = (tel || "").toString().replace(/\D/g, "");
  if (chiffres.startsWith("00225")) chiffres = chiffres.slice(5);
  else if (chiffres.startsWith("225") && chiffres.length > 10)
    chiffres = chiffres.slice(3);
  return chiffres;
};

const creerEmpreinte = (nom, prenom, telephone) => {
  return [
    normaliserTexte(nom),
    normaliserTexte(prenom),
    normaliserTelephone(telephone),
  ].join("|");
};

/* =========================================================
   APPLICATION
========================================================= */

function App() {
  const [pageActuelle, setPageActuelle] = useState(
    window.location.hash === "#admin" ? "admin" : "accueil"
  );

  useEffect(() => {
    const changerPage = () => {
      setPageActuelle(window.location.hash === "#admin" ? "admin" : "accueil");
    };
    window.addEventListener("hashchange", changerPage);
    return () => window.removeEventListener("hashchange", changerPage);
  }, []);

  /* =========================================================
     GALERIE
  ========================================================= */

  const [photoActuelle, setPhotoActuelle] = useState(0);
  const [photoGalerieMobile, setPhotoGalerieMobile] = useState(0);

  useEffect(() => {
    const defilement = setInterval(() => {
      setPhotoActuelle((p) => (p === photos.length - 1 ? 0 : p + 1));
    }, 4500);
    return () => clearInterval(defilement);
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 650) return;
    const interval = setInterval(() => {
      setPhotoGalerieMobile((p) => (p === photos.length - 1 ? 0 : p + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  /* =========================================================
     BOUTON HAUT
  ========================================================= */

  const [afficherBoutonHaut, setAfficherBoutonHaut] = useState(false);

  useEffect(() => {
    const gererScroll = () => setAfficherBoutonHaut(window.scrollY > 500);
    window.addEventListener("scroll", gererScroll);
    return () => window.removeEventListener("scroll", gererScroll);
  }, []);

  const photoPrecedente = () =>
    setPhotoActuelle((p) => (p === 0 ? photos.length - 1 : p - 1));
  const photoSuivante = () =>
    setPhotoActuelle((p) => (p === photos.length - 1 ? 0 : p + 1));

  const photoGaleriePrecedente = () =>
    setPhotoGalerieMobile((p) => (p === 0 ? photos.length - 1 : p - 1));
  const photoGalerieSuivante = () =>
    setPhotoGalerieMobile((p) => (p === photos.length - 1 ? 0 : p + 1));

  const retourEnHaut = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

  /* =========================================================
     FORMULAIRE NOUVEAU
  ========================================================= */

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [statut, setStatut] = useState("");
  const [departement, setDepartement] = useState("");

  const [formulaireEnvoye, setFormulaireEnvoye] = useState(false);
  const [messageSucces, setMessageSucces] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState("");

  /* =========================================================
     MODE : null | "nouveau" | "membre"
  ========================================================= */

  const [mode, setMode] = useState(null);

  /* =========================================================
     RECHERCHE MEMBRE
  ========================================================= */

  const [rechercheMembre, setRechercheMembre] = useState("");
  const [resultatsMembre, setResultatsMembre] = useState([]);
  const [membreSelectionne, setMembreSelectionne] = useState(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  /* =========================================================
     GÉNÉRATION NOUVEL ID
  ========================================================= */

  const genererNouvelId = async () => {
    const counterRef = doc(db, "personnes", "_counter");
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let currentId = counterDoc.exists()
        ? counterDoc.data().currentId || 0
        : 0;
      const nouveauId = `BT-${String(currentId + 1).padStart(4, "0")}`;
      transaction.set(counterRef, { currentId: currentId + 1 });
      return nouveauId;
    });
  };

  /* =========================================================
     VÉRIFIER SI DÉJÀ POINTÉ AUJOURD'HUI
  ========================================================= */

  const aDejaPointeAujourdhui = async (personneId, datePresence) => {
    try {
      const presencesRef = collection(db, "presences");
      const q = query(presencesRef, where("personneId", "==", personneId));
      const snap = await getDocs(q);
      return snap.docs.some((d) => d.data().date === datePresence);
    } catch (err) {
      console.error("Erreur vérif double pointage :", err);
      return false;
    }
  };

  /* =========================================================
     ENVOI FORMULAIRE "NOUVEAU"
  ========================================================= */

  const envoyerFormulaire = async (evenement) => {
    evenement.preventDefault();
    setErreurEnregistrement("");
    setEnregistrementEnCours(true);

    try {
      const maintenant = new Date();
      const datePresence = maintenant.toLocaleDateString("fr-FR");
      const heurePresence = maintenant.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const nomTrim = nom.trim().toUpperCase();
      const prenomTrim = prenom.trim();
      const telephoneTrim = telephone.trim();

      const personnesRef = collection(db, "personnes");
      const empreinte = creerEmpreinte(nomTrim, prenomTrim, telephoneTrim);
      const qVerif = query(personnesRef, where("empreinte", "==", empreinte));
      const snapVerif = await getDocs(qVerif);

      if (!snapVerif.empty) {
        const existe = snapVerif.docs[0].data();
        setErreurEnregistrement(
          `⚠️ Il existe déjà une fiche au nom de ${existe.nom} ${existe.prenom} (${existe.personneId}). Si c'est toi, clique sur "JE SUIS MEMBRE".`
        );
        setEnregistrementEnCours(false);
        return;
      }

      const personneId = await genererNouvelId();

      await addDoc(personnesRef, {
        personneId,
        nom: nomTrim,
        prenom: prenomTrim,
        telephone: telephoneTrim,
        empreinte,
        statut,
        departement,
        dateCreation: serverTimestamp(),
      });

      await addDoc(collection(db, "presences"), {
        personneId,
        nom: nomTrim,
        prenom: prenomTrim,
        telephone: telephoneTrim,
        statut,
        departement,
        date: datePresence,
        heure: heurePresence,
        dateEnregistrement: serverTimestamp(),
      });

      setMessageSucces(
        `✅ Bienvenue ${prenomTrim} ! Ton ID est ${personneId}. Ta présence a été enregistrée.`
      );
      setFormulaireEnvoye(true);
    } catch (erreur) {
      console.error("❌ Erreur :", erreur);
      setErreurEnregistrement(`Erreur : ${erreur.message}`);
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  /* =========================================================
     RECHERCHE MEMBRE EN TEMPS RÉEL
  ========================================================= */

  useEffect(() => {
    if (mode !== "membre") return;
    if (membreSelectionne) return; // on ne cherche plus quand sélectionné

    if (rechercheMembre.trim().length < 2) {
      setResultatsMembre([]);
      return;
    }

    setRechercheEnCours(true);
    const personnesRef = collection(db, "personnes");
    const terme = rechercheMembre.trim().toUpperCase();

    const unsub = onSnapshot(personnesRef, (snapshot) => {
      const tous = snapshot.docs
        .filter((d) => d.id !== "_counter")
        .map((d) => ({ id: d.id, ...d.data() }));

      const filtres = tous.filter((p) => {
        const nomComplet = `${p.nom || ""} ${p.prenom || ""}`.toUpperCase();
        return nomComplet.includes(terme);
      });

      setResultatsMembre(filtres.slice(0, 8));
      setRechercheEnCours(false);
    });

    return () => unsub();
  }, [rechercheMembre, mode, membreSelectionne]);

  /* =========================================================
     CONFIRMER PRÉSENCE MEMBRE
  ========================================================= */

  const confirmerPresenceMembre = async () => {
    if (!membreSelectionne) return;
    setErreurEnregistrement("");
    setEnregistrementEnCours(true);

    try {
      const maintenant = new Date();
      const datePresence = maintenant.toLocaleDateString("fr-FR");
      const heurePresence = maintenant.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const dejaPointe = await aDejaPointeAujourdhui(
        membreSelectionne.personneId,
        datePresence
      );

      if (dejaPointe) {
        setErreurEnregistrement(
          `✅ Tu as déjà pointé aujourd'hui. À samedi prochain ${membreSelectionne.prenom} !`
        );
        setEnregistrementEnCours(false);
        return;
      }

      await addDoc(collection(db, "presences"), {
        personneId: membreSelectionne.personneId,
        nom: membreSelectionne.nom,
        prenom: membreSelectionne.prenom,
        telephone: membreSelectionne.telephone || "",
        statut: membreSelectionne.statut || "",
        departement: membreSelectionne.departement || "",
        date: datePresence,
        heure: heurePresence,
        dateEnregistrement: serverTimestamp(),
      });

      setMessageSucces(
        `✅ Merci ${membreSelectionne.prenom} ! Ta présence a bien été enregistrée.`
      );
      setFormulaireEnvoye(true);
    } catch (erreur) {
      console.error("❌ Erreur :", erreur);
      setErreurEnregistrement(`Erreur : ${erreur.message}`);
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  /* =========================================================
     RESET
  ========================================================= */

  const nouveauRemplissage = () => {
    setNom("");
    setPrenom("");
    setTelephone("");
    setStatut("");
    setDepartement("");
    setFormulaireEnvoye(false);
    setErreurEnregistrement("");
    setMessageSucces("");
    setMode(null);
    setRechercheMembre("");
    setResultatsMembre([]);
    setMembreSelectionne(null);
  };

  if (pageActuelle === "admin") {
    return <Admin />;
  }

  /* =========================================================
     RENDU
  ========================================================= */

  return (
    <div className="application">
      <header className="en-tete">
        <a href="#accueil" className="logo">
          <img
            src={process.env.PUBLIC_URL + "/images/LOGO.png"}
            alt="BLOOM AVF"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/LOGO.png";
            }}
          />
        </a>

        <nav className="navigation">
          <a href="#accueil">ACCUEIL</a>
          <a href="#apropos">À PROPOS</a>
          <a href="#galerie">GALERIE</a>
          <a href="#presence">PRÉSENCE</a>
        </nav>

        <div className="boutons-droite">
          <a
            href="#admin"
            className="bouton-admin"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "admin";
            }}
          >
            ADMIN
          </a>
          <a href="#presence" className="bouton-en-tete">
            PRÉSENCE <span>↗</span>
          </a>
        </div>
      </header>

      <main>
        <section className="accueil" id="accueil">
          <div className="accueil-contenu">
            <div className="autocollant">BLOOM AVF</div>
            <p className="petite-etiquette">ASSEMBLÉE VIE FRUCTUEUSE</p>
            <h1>
              BLOOM
              <br />
              <span>TEAMS</span>
            </h1>
            <p className="description-accueil">
              Une famille. Une vision. Une génération qui grandit, sert et
              porte du fruit ensemble.
            </p>
            <a href="#presence" className="bouton-principal">
              RENSEIGNER MA PRÉSENCE <span>→</span>
            </a>
          </div>

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
              <button onClick={photoPrecedente} aria-label="Photo précédente">
                ←
              </button>
              <span>
                {String(photoActuelle + 1).padStart(2, "0")} /{" "}
                {String(photos.length).padStart(2, "0")}
              </span>
              <button onClick={photoSuivante} aria-label="Photo suivante">
                →
              </button>
            </div>
          </div>
        </section>

        <section className="a-propos" id="apropos">
          <div className="numero-section">01</div>
          <div className="a-propos-contenu">
            <p className="petite-etiquette">NOTRE FAMILLE</p>
            <h2>
              ASSEMBLEE VIE FRUCTUEUSE
              <br />
              <span>BLOOM.</span>
            </h2>
            <p className="texte-a-propos">
              BLOOM est un espace où chaque personne compte. Nous avançons
              ensemble dans une même vision, avec l'envie de grandir, de servir
              et de faire la différence.
            </p>
            <div className="etiquettes">
              <span>FOI</span>
              <span>FAMILLE</span>
              <span>SERVICE</span>
            </div>
          </div>
          <div className="symbole">✦</div>
        </section>

        <section className="section-galerie" id="galerie">
          <div className="en-tete-galerie">
            <div>
              <p className="petite-etiquette">NOS MOMENTS</p>
              <h2>
                CHURCH
                <br />
                <span>GALERIE</span>
              </h2>
            </div>
          </div>

          <div className="grille-galerie grille-desktop">
            {photos.map((photo, index) => (
              <div
                className={
                  index === 0 ? "image-galerie grande" : "image-galerie"
                }
                key={photo}
              >
                <img src={photo} alt={`Galerie BLOOM ${index + 1}`} />
                <div className="legende-image">
                  <span>BLOOM</span>
                  <span>0{index + 1}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="carrousel-mobile">
            <div className="carrousel-track">
              {photos.map((photo, index) => (
                <div
                  key={photo}
                  className={`carrousel-slide ${
                    index === photoGalerieMobile ? "actif" : ""
                  }`}
                >
                  <img src={photo} alt={`Galerie BLOOM ${index + 1}`} />
                  <div className="legende-carrousel">
                    <span>BLOOM</span>
                    <span>
                      0{index + 1} / {String(photos.length).padStart(2, "0")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="controle-carrousel">
              <button
                onClick={photoGaleriePrecedente}
                aria-label="Photo précédente"
              >
                ←
              </button>
              <span>
                {String(photoGalerieMobile + 1).padStart(2, "0")} /{" "}
                {String(photos.length).padStart(2, "0")}
              </span>
              <button
                onClick={photoGalerieSuivante}
                aria-label="Photo suivante"
              >
                →
              </button>
            </div>
            <div className="indicateurs-carrousel">
              {photos.map((_, index) => (
                <span
                  key={index}
                  className={`point-indicateur ${
                    index === photoGalerieMobile ? "actif" : ""
                  }`}
                  onClick={() => setPhotoGalerieMobile(index)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="section-presence" id="presence">
          <div className="introduction-presence">
            <div className="numero-section">02</div>
            <p className="petite-etiquette">CULTE DU SAMEDI</p>
            <h2>
              BLOOM
              <br />
              <span>TEAMS</span>
            </h2>
            <p className="texte-presence">
              Chaque samedi, nous prenons le temps de nous retrouver, de
              grandir ensemble et de vivre pleinement notre famille.
            </p>
            <div className="decoration-formulaire">1 CULTE = 1 PRÉSENCE</div>
          </div>

          <div className="conteneur-formulaire">

            {/* =============================================
                ÉCRAN SUCCÈS
            ============================================= */}
            {formulaireEnvoye ? (
              <div className="message-succes">
                <div className="icone-succes">✓</div>
                <p className="petite-etiquette">PRÉSENCE ENREGISTRÉE</p>
                <h3>
                  MERCI
                  <br />
                  <span>
                    {(mode === "membre"
                      ? membreSelectionne?.prenom
                      : prenom
                    )?.toUpperCase()}
                  </span>
                </h3>
                <p>{messageSucces}</p>
                <button
                  className="bouton-secondaire"
                  onClick={nouveauRemplissage}
                >
                  NOUVELLE PRÉSENCE
                </button>
              </div>
            ) : mode === null ? (
              /* =============================================
                 ÉCRAN DE CHOIX
              ============================================= */
              <div className="choix-portes">
                <p className="petite-etiquette">QUI ES-TU ?</p>
                <h3>CHOISIS TON PARCOURS</h3>

                <div className="portes">
                  <button
                    className="porte porte-nouveau"
                    onClick={() => setMode("nouveau")}
                  >
                    <div className="porte-icone">🌱</div>
                    <div>
                      <strong>JE SUIS NOUVEAU</strong>
                      <small>C'est ma première fois à BLOOM</small>
                    </div>
                    <span className="porte-arrow">→</span>
                  </button>

                  <button
                    className="porte porte-membre"
                    onClick={() => setMode("membre")}
                  >
                    <div className="porte-icone">👥</div>
                    <div>
                      <strong>JE SUIS MEMBRE DE L'ÉGLISE</strong>
                      <small>J'ai déjà pointé une fois</small>
                    </div>
                    <span className="porte-arrow">→</span>
                  </button>
                </div>
              </div>
            ) : mode === "nouveau" ? (
              /* =============================================
                 FORMULAIRE NOUVEAU
              ============================================= */
              <form onSubmit={envoyerFormulaire}>
                <div className="retour-mode">
                  <button type="button" onClick={() => setMode(null)}>
                    ← Retour
                  </button>
                </div>

                <div className="bloc-formulaire">
                  <div className="titre-bloc">
                    <span>01</span>
                    TES INFORMATIONS
                  </div>

                  <div className="ligne-champs">
                    <div className="groupe-formulaire">
                      <label htmlFor="nom">NOM</label>
                      <input
                        id="nom"
                        type="text"
                        placeholder="Ton nom"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        required
                      />
                    </div>

                    <div className="groupe-formulaire">
                      <label htmlFor="prenom">PRÉNOM</label>
                      <input
                        id="prenom"
                        type="text"
                        placeholder="Ton prénom"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="groupe-formulaire">
                    <label htmlFor="telephone">
                      NUMÉRO DE TÉLÉPHONE (optionnel)
                    </label>
                    <input
                      id="telephone"
                      type="tel"
                      placeholder="Le tien, ou celui d'un parent"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                    />
                    <small className="aide-champ">
                      Si tu n'as pas de numéro, laisse vide.
                    </small>
                  </div>
                </div>

                <div className="bloc-formulaire">
                  <div className="titre-bloc">
                    <span>02</span>
                    ES-TU MEMBRE ?
                  </div>

                  <div className="choix-horizontal">
                    <label className="choix">
                      <input
                        type="radio"
                        name="statut"
                        value="Oui"
                        checked={statut === "Oui"}
                        onChange={(e) => setStatut(e.target.value)}
                        required
                      />
                      <span>
                        <strong>OUI</strong>
                        <small>Je suis membre</small>
                      </span>
                    </label>

                    <label className="choix">
                      <input
                        type="radio"
                        name="statut"
                        value="Non"
                        checked={statut === "Non"}
                        onChange={(e) => setStatut(e.target.value)}
                      />
                      <span>
                        <strong>NON</strong>
                        <small>Je ne suis pas membre</small>
                      </span>
                    </label>

                    <label className="choix">
                      <input
                        type="radio"
                        name="statut"
                        value="Nouveau"
                        checked={statut === "Nouveau"}
                        onChange={(e) => setStatut(e.target.value)}
                      />
                      <span>
                        <strong>NOUVEAU</strong>
                        <small>C'est ma première fois</small>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="bloc-formulaire">
                  <div className="titre-bloc">
                    <span>03</span>
                    TON DÉPARTEMENT
                  </div>

                  <div className="choix-departements">
                    {[
                      "ACCUEIL",
                      "CHANTRE",
                      "GESTION DU CULTE",
                      "MRES",
                      "INTERCESION",
                      "COMMUNICATION",
                      "ADN",
                      "AUTRE",
                    ].map((nomDepartement) => (
                      <label className="choix" key={nomDepartement}>
                        <input
                          type="radio"
                          name="departement"
                          value={nomDepartement}
                          checked={departement === nomDepartement}
                          onChange={(e) => setDepartement(e.target.value)}
                          required
                        />
                        <span>{nomDepartement}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {erreurEnregistrement && (
                  <div className="message-erreur">{erreurEnregistrement}</div>
                )}

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
                  <strong>→</strong>
                </button>
              </form>
            ) : (
              /* =============================================
                 ÉCRAN MEMBRE — RECHERCHE OU CONFIRMATION
              ============================================= */
              <div className="bloc-membre">
                <div className="retour-mode">
                  <button
                    type="button"
                    onClick={() => {
                      if (membreSelectionne) {
                        setMembreSelectionne(null);
                        setRechercheMembre("");
                      } else {
                        setMode(null);
                      }
                    }}
                  >
                    ← Retour
                  </button>
                </div>

                {!membreSelectionne ? (
                  /* ---------- ÉTAPE RECHERCHE ---------- */
                  <>
                    <div className="titre-bloc">
                      <span>👥</span>
                      RECHERCHE TON NOM
                    </div>

                    <div className="groupe-formulaire">
                      <label htmlFor="recherche-membre">
                        TAPE TON NOM OU TON PRÉNOM
                      </label>
                      <input
                        id="recherche-membre"
                        type="text"
                        placeholder="Ex : Borel, Tiefoue, Kouassi..."
                        value={rechercheMembre}
                        onChange={(e) => {
                          setRechercheMembre(e.target.value);
                        }}
                        autoFocus
                      />
                    </div>

                    {rechercheMembre.trim().length >= 2 && (
                      <div className="liste-resultats">
                        {rechercheEnCours &&
                          resultatsMembre.length === 0 && (
                            <div className="resultat-vide">Recherche...</div>
                          )}

                        {!rechercheEnCours &&
                          resultatsMembre.length === 0 && (
                            <div className="resultat-vide">
                              Aucun nom trouvé. Es-tu sûr d'être déjà venu ?
                              <br />
                              <button
                                type="button"
                                className="bouton-lien"
                                onClick={() => setMode("nouveau")}
                              >
                                → Je suis nouveau, je m'inscris
                              </button>
                            </div>
                          )}

                        {resultatsMembre.map((personne) => (
                          <button
                            key={personne.id}
                            type="button"
                            className="resultat-item"
                            onClick={() => {
                              setMembreSelectionne(personne);
                              setResultatsMembre([]);
                            }}
                          >
                            <div className="resultat-avatar">
                              {(personne.prenom?.charAt(0) ||
                                personne.nom?.charAt(0) ||
                                "?"
                              ).toUpperCase()}
                            </div>
                            <div className="resultat-info">
                              <strong>
                                {personne.nom} {personne.prenom}
                              </strong>
                              <small>
                                {personne.personneId}
                                {personne.departement
                                  ? ` • ${personne.departement}`
                                  : ""}
                                {personne.telephone
                                  ? ` • ${personne.telephone}`
                                  : ""}
                              </small>
                            </div>
                            <span className="resultat-arrow">→</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* ---------- ÉTAPE CONFIRMATION ---------- */
                  <div className="bloc-confirmation">
                    <div className="confirmation-entete">
                      <p className="petite-etiquette">
                        VÉRIFIE TES INFORMATIONS
                      </p>
                      <h3>EST-CE BIEN TOI ?</h3>
                    </div>

                    <div className="carte-membre">
                      <div className="carte-membre-avatar">
                        {(membreSelectionne.prenom?.charAt(0) ||
                          membreSelectionne.nom?.charAt(0) ||
                          "?"
                        ).toUpperCase()}
                      </div>

                      <div className="carte-membre-infos">
                        <div className="info-ligne">
                          <span>NOM</span>
                          <strong>{membreSelectionne.nom || "-"}</strong>
                        </div>
                        <div className="info-ligne">
                          <span>PRÉNOM</span>
                          <strong>{membreSelectionne.prenom || "-"}</strong>
                        </div>
                        <div className="info-ligne">
                          <span>ID</span>
                          <strong className="badge-id-membre">
                            {membreSelectionne.personneId}
                          </strong>
                        </div>
                        <div className="info-ligne">
                          <span>TÉLÉPHONE</span>
                          <strong>{membreSelectionne.telephone || "-"}</strong>
                        </div>
                        <div className="info-ligne">
                          <span>DÉPARTEMENT</span>
                          <strong>
                            {membreSelectionne.departement || "-"}
                          </strong>
                        </div>
                        <div className="info-ligne">
                          <span>STATUT</span>
                          <strong>
                            {membreSelectionne.statut === "Oui"
                              ? "MEMBRE"
                              : membreSelectionne.statut === "Nouveau"
                              ? "NOUVEAU"
                              : "NON-MEMBRE"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {erreurEnregistrement && (
                      <div className="message-erreur">
                        {erreurEnregistrement}
                      </div>
                    )}

                    <button
                      type="button"
                      className="bouton-envoi"
                      onClick={confirmerPresenceMembre}
                      disabled={enregistrementEnCours}
                    >
                      <span>
                        {enregistrementEnCours
                          ? "ENREGISTREMENT..."
                          : "CONFIRMER MA PRÉSENCE"}
                      </span>
                      <strong>✓</strong>
                    </button>

                    <button
                      type="button"
                      className="bouton-secondaire"
                      onClick={() => {
                        setMembreSelectionne(null);
                        setRechercheMembre("");
                        setErreurEnregistrement("");
                      }}
                    >
                      ← Ce n'est pas moi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <button
        className={`bouton-retour-haut ${
          afficherBoutonHaut ? "visible" : ""
        }`}
        onClick={retourEnHaut}
        aria-label="Retour en haut"
      >
        ↑
      </button>

      <footer className="pied-page">
        <div className="motif-pied">BLOOM</div>
        <div className="contenu-pied">
          <div className="logo-pied">BLOOM</div>
          <p>
            UNE FAMILLE.
            <br />
            UNE VISION.
            <br />
            UNE GÉNÉRATION.
          </p>
        </div>
        <div className="bas-pied">
          <span>BLOOM AVF</span>
          <span>BLOOM TEAMS</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default App;