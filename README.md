# 🌸 BLOOM TEAMS

## 📖 À PROPOS

**BLOOM TEAMS** est une application web développée pour **BLOOM AVF (Assemblée Vie Fructueuse)** afin de faciliter la gestion et le suivi des présences lors des cultes.

L'application a été pensée pour répondre à un besoin simple : **mieux connaître, suivre et accompagner les personnes qui participent à la vie de l'église.**

## 🎯 POURQUOI BLOOM TEAMS ?

BLOOM TEAMS permet notamment de :

* Enregistrer les présences lors des cultes
* Identifier les personnes présentes régulièrement
* Suivre la participation sur les différents samedis du mois
* Identifier les personnes très actives, actives, à suivre ou non actives
* Faciliter le suivi et l'accompagnement des personnes
* Centraliser les informations dans une base de données
* Réduire les tâches manuelles liées au suivi des présences

L'objectif n'est pas seulement de compter les présences, mais de disposer d'un outil permettant à l'église de **mieux suivre les personnes et de renforcer leur accompagnement.**

## 🆔 SYSTÈME D'IDENTIFICATION

Chaque personne enregistrée reçoit automatiquement un identifiant unique :

```text
BT-0000
BT-0001
BT-0002
BT-0003
...
```

Le numéro commence à **BT-0000**.

Le numéro de téléphone sert uniquement de moyen de contact et **n'est pas utilisé comme identifiant unique**, car plusieurs personnes d'une même famille peuvent utiliser le même numéro.

Une personne qui revient à un autre culte conserve donc son identifiant.

## 📅 SUIVI DES PRÉSENCES

Les cultes sont organisés chaque samedi.

BLOOM TEAMS permet de suivre les présences sur les **4 samedis du mois** afin d'obtenir une vision de la participation de chaque personne.

### Niveau d'activité

| Présences | Niveau         |
| --------- | -------------- |
| 4/4       | 🟢 SUPER ACTIF |
| 3/4       | 🔵 ACTIF       |
| 2/4       | 🟠 À SUIVRE    |
| 0–1/4     | 🔴 NON ACTIF   |

## 📝 INFORMATIONS ENREGISTRÉES

Lors de l'enregistrement, les informations suivantes peuvent être renseignées :

* Nom
* Prénom
* Téléphone
* Statut
* Département
* Date
* Heure
* Date d'enregistrement
* Identifiant unique

### Statuts

* **OUI**
* **NON**
* **NOUVEAU**

### Départements

* ACCUEIL
* LOUANGE
* COMMUNICATION
* ADN
* JEUNESSE
* AUTRE

## 🛠️ TECHNOLOGIES UTILISÉES

* **React.js**
* **JavaScript**
* **HTML5**
* **CSS3**
* **Firebase**
* **Firestore**
* **Git**
* **GitHub**
* **GitHub Pages**

## 🗂️ ORGANISATION DES DONNÉES

Les données sont séparées en deux principales collections Firebase :

```text
Firebase
│
├── personnes
│   ├── BT-0000
│   ├── BT-0001
│   ├── BT-0002
│   └── ...
│
└── presences
    ├── présence 1
    ├── présence 2
    ├── présence 3
    └── ...
```

### `personnes`

Contient les informations permanentes de chaque personne et son identifiant unique.

### `presences`

Contient l'historique des présences enregistrées lors des différents cultes.

## 💻 INSTALLATION

Cloner le projet :

```bash
git clone https://github.com/borelofficiel/Bloom-Teams.git
```

Installer les dépendances :

```bash
npm install
```

Lancer le projet :

```bash
npm start
```

## 🔐 ACCÈS ADMINISTRATEUR

L'application possède également une interface d'administration permettant de consulter les données et les statistiques de présence.

Accès local :

```text
http://localhost:3000/#admin
```

Accès en ligne :

```text
https://borelofficiel.github.io/Bloom-Teams/#admin
```

## 🌐 APPLICATION EN LIGNE

**BLOOM TEAMS :**

[https://borelofficiel.github.io/Bloom-Teams/](https://borelofficiel.github.io/Bloom-Teams/)

## 📁 STRUCTURE DU PROJET

```text
Bloom-Teams/
│
├── public/
│   └── images/
│
├── src/
│   ├── App.js
│   ├── App.css
│   └── ...
│
├── package.json
├── README.md
└── ...
```

## ⛪ CONTEXTE DU PROJET

BLOOM TEAMS a été conçu pour accompagner la gestion des présences au sein de **BLOOM AVF — Assemblée Vie Fructueuse**.

Le projet s'inscrit dans une démarche de **digitalisation du suivi des personnes**, avec pour objectif de rendre la gestion des présences plus simple, plus rapide et plus organisée.

L'application pourra évoluer progressivement en fonction des besoins de l'église et intégrer de nouvelles fonctionnalités.

---

**Un outil numérique pour mieux suivre, organiser et accompagner les personnes qui participent à la vie de l'église.**
