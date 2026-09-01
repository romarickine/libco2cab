/**
 * main.js
 * ----------------------------------------------------------------------
 * Point d'entrée de l'application. Détient l'état global (état courant du
 * formulaire, écran affiché, étape de l'assistant, sélection d'actions...)
 * et orchestre l'affichage en déléguant tout le rendu à ui.js. Aucun calcul
 * ni accès au stockage ne se fait directement ici.
 * ----------------------------------------------------------------------
 */
import { FAMILLES } from "./data/facteurs-emission.js";
import { ZONES } from "./data/zonage-insee.js";
import { calculerBilan, calculerActions, totalReductionPlan } from "./calcul.js";
import { lireBrouillon, sauvegarderBrouillon, supprimerBrouillon, enregistrerBilan, listerBilans } from "./stockage.js";
import * as ui from "./ui.js";

// --- État initial du formulaire (une "saisie" complète) ---
export function etatInitial() {
  return {
    profil: {
      familleId: "sante", metierId: FAMILLES[0].metiers[0],
      mode: "seul", nbPraticiens: 1, nbSalaries: 0,
      zoneId: "moyen_pole", villeLabel: "",
      nbActesAn: 3000, partCabinet: 70, recoitPublic: true,
    },
    deplacements: {
      modeDomTrav: "voiture_thermique", kmAllerJour: 8, joursSemaine: 4.5, semainesAn: 45,
      kmVisitesAn: 1500, modeVisites: "voiture_thermique",
      nbCongresAn: 2, modeCongres: "train_tgv", kmCongresAR: 400,
    },
    local: {
      aLocal: true, surface: 40, energieChauffage: "gaz",
      consoElecConnue: false, consoElecKwh: 0,
      consoChauffageConnue: false, consoChauffageKwh: 0,
      localDeporte: false, surfaceDeportee: 15,
    },
    numerique: { nbOrdisFixes: 0, nbOrdisPortables: 1, nbEcransSuppl: 1, usage: "moyen" },
    materiel: {},
    investissements: { actif: false, mobilier: 0, gros: {} },
    alimentation: { repasParSemaine: 2, partVegetarienne: 30 },
    services: { servicesAn: 3000, sousTraitanceAn: 1000, nbColisAn: 20 },
    pharmacien: { caMedicaments: 0, caParapharmacie: 0 },
    prescriptions: { active: false, depenseMedicaments: 0, depenseActes: 0 },
  };
}

const ETAPES = ["profil", "deplacements", "local", "numerique", "materiel", "alimentation", "services"];

// --- État global de l'application ---
const etat = {
  ecran: "intro", // intro | wizard | resultats | historique
  etapeIndex: 0,
  data: etatInitial(),
  typeGraphique: "pie",
  actionsSelectionnees: {}, // { [id]: { checked, pct, degres } }
  afficherPlusActions: false,
  typeCertificat: "idle",
  nomCabinet: "",
};

function familleActuelle() { return FAMILLES.find((f) => f.id === etat.data.profil.familleId) || FAMILLES[0]; }
function zoneActuelle() { return ZONES.find((z) => z.id === etat.data.profil.zoneId) || ZONES[0]; }

// Recalcule le bilan courant à partir de l'état de saisie.
function resultatsCourants() {
  return calculerBilan(etat.data, familleActuelle(), zoneActuelle());
}

const racine = document.getElementById("app");

// --- Boucle de rendu : redessine l'écran courant. Préserve le focus (et la
// position du curseur) du champ actif pour ne pas gêner la saisie lorsqu'un
// badge en direct force un nouveau rendu. ---
function majLive() {
  ui.majBadgesEtTotal(resultatsCourants());
}

export function render() {
  const actif = document.activeElement;
  const champActif = actif && actif.dataset ? actif.dataset.field : null;
  const selStart = actif && "selectionStart" in actif ? actif.selectionStart : null;

  if (etat.ecran === "intro") {
    ui.renderIntro(racine, { onStart: demarrer });
  } else if (etat.ecran === "wizard") {
    ui.renderWizard(racine, {
      data: etat.data, etapes: ETAPES, etapeIndex: etat.etapeIndex,
      famille: familleActuelle(), zone: zoneActuelle(), resultats: resultatsCourants(),
      onChangeProfil: (f, v) => { etat.data.profil[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeProfilLive: (f, v) => { etat.data.profil[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeFamille: (fid) => {
        const f = FAMILLES.find((x) => x.id === fid);
        etat.data.profil.familleId = fid; etat.data.profil.metierId = f.metiers[0];
        etat.data.materiel = {}; sauvegarderBrouillon(etat.data); render();
      },
      onChangeDeplacements: (f, v) => { etat.data.deplacements[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeDeplacementsLive: (f, v) => { etat.data.deplacements[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeLocal: (f, v) => { etat.data.local[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeLocalLive: (f, v) => { etat.data.local[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeNumerique: (f, v) => { etat.data.numerique[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeNumeriqueLive: (f, v) => { etat.data.numerique[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeMateriel: (id, v) => { etat.data.materiel[id] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeMaterielLive: (id, v) => { etat.data.materiel[id] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeInvestissements: (f, v) => { etat.data.investissements[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeInvestissementsLive: (f, v) => { etat.data.investissements[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeGrosMateriel: (id, v) => { etat.data.investissements.gros[id] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeGrosMaterielLive: (id, v) => { etat.data.investissements.gros[id] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeAlimentation: (f, v) => { etat.data.alimentation[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeAlimentationLive: (f, v) => { etat.data.alimentation[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangeServices: (f, v) => { etat.data.services[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangeServicesLive: (f, v) => { etat.data.services[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangePharmacienLive: (f, v) => { etat.data.pharmacien[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onChangePrescriptions: (f, v) => { etat.data.prescriptions[f] = v; sauvegarderBrouillon(etat.data); render(); },
      onChangePrescriptionsLive: (f, v) => { etat.data.prescriptions[f] = v; sauvegarderBrouillon(etat.data); majLive(); },
      onPrev: () => { if (etat.etapeIndex > 0) { etat.etapeIndex--; sauvegarderBrouillon(etat.data); render(); } },
      onNext: () => {
        if (etat.etapeIndex < ETAPES.length - 1) { etat.etapeIndex++; sauvegarderBrouillon(etat.data); render(); }
        else { etat.ecran = "resultats"; render(); }
      },
    });
  } else if (etat.ecran === "resultats") {
    const resultats = resultatsCourants();
    ui.renderResultats(racine, {
      famille: familleActuelle(), data: etat.data, resultats,
      typeGraphique: etat.typeGraphique,
      actionsCalculees: calculerActions(resultats, etat.actionsSelectionnees),
      afficherPlusActions: etat.afficherPlusActions,
      totalReductionPlan: totalReductionPlan(calculerActions(resultats, etat.actionsSelectionnees)),
      typeCertificat: etat.typeCertificat,
      nomCabinet: etat.nomCabinet,
      onChangeTypeGraphique: (t) => { etat.typeGraphique = t; render(); },
      onToggleAction: (id, defaultPct) => {
        const cur = etat.actionsSelectionnees[id] || { checked: false, pct: defaultPct };
        etat.actionsSelectionnees[id] = { ...cur, checked: !cur.checked };
        render();
      },
      onSetActionPct: (id, pct) => {
        etat.actionsSelectionnees[id] = { ...(etat.actionsSelectionnees[id] || {}), checked: true, pct };
        render();
      },
      onSetActionDegres: (id, degres) => {
        etat.actionsSelectionnees[id] = { ...(etat.actionsSelectionnees[id] || {}), checked: true, degres };
        render();
      },
      onToggleAfficherPlus: () => { etat.afficherPlusActions = !etat.afficherPlusActions; render(); },
      onChangeNomCabinet: (v) => { etat.nomCabinet = v; },
      onExporterCertificat: async () => {
        etat.typeCertificat = "loading"; render();
        try {
          const { exporterCertificat } = await import("./certificat.js");
          await exporterCertificat(document.getElementById("canvas-certificat"), {
            famille: familleActuelle(), profil: etat.data.profil, results: resultats, nomCabinet: etat.nomCabinet,
          });
          etat.typeCertificat = "ok";
        } catch (e) {
          console.error(e);
          etat.typeCertificat = "erreur";
        }
        render();
      },
      onEnregistrerBilan: () => {
        enregistrerBilan({ data: etat.data, resultats, nomCabinet: etat.nomCabinet });
        etat.ecran = "historique"; render();
      },
      onVoirHistorique: () => { etat.ecran = "historique"; render(); },
      onBack: () => { etat.ecran = "wizard"; etat.etapeIndex = 0; render(); },
      onRestart: reinitialiser,
    });
  } else if (etat.ecran === "historique") {
    ui.renderHistorique(racine, {
      bilans: listerBilans(),
      onSupprimer: (id) => { import("./stockage.js").then((m) => { m.supprimerBilan(id); render(); }); },
      onBack: () => { etat.ecran = "resultats"; render(); },
      onNouveauBilan: reinitialiser,
    });
  }

  if (champActif) {
    const nouvelElement = document.querySelector(`[data-field="${champActif}"]`);
    if (nouvelElement) {
      nouvelElement.focus();
      if (selStart !== null && "setSelectionRange" in nouvelElement) {
        try { nouvelElement.setSelectionRange(selStart, selStart); } catch (e) { /* type d'input sans sélection, ignorer */ }
      }
    }
  }
}

function demarrer() {
  etat.ecran = "wizard";
  etat.etapeIndex = 0;
  sauvegarderBrouillon(etat.data);
  render();
}

function reinitialiser() {
  etat.ecran = "intro";
  etat.etapeIndex = 0;
  etat.data = etatInitial();
  etat.actionsSelectionnees = {};
  etat.afficherPlusActions = false;
  etat.typeCertificat = "idle";
  etat.nomCabinet = "";
  supprimerBrouillon();
  render();
}

// Fusionne un état sauvegardé (brouillon ou bilan historique) avec les
// valeurs par défaut actuelles, section par section. Indispensable pour
// rester compatible avec des données enregistrées par une version
// antérieure de l'outil : si un nouveau champ ou une nouvelle section est
// ajoutée au formulaire plus tard, un ancien brouillon ne doit jamais faire
// planter le rendu faute de cette clé — il doit simplement récupérer sa
// valeur par défaut. Sans cette fusion, l'écran correspondant reste blanc
// (erreur JS silencieuse en production).
function fusionnerAvecDefauts(donneesSauvegardees) {
  const defauts = etatInitial();
  const fusion = {};
  for (const section of Object.keys(defauts)) {
    fusion[section] = { ...defauts[section], ...(donneesSauvegardees[section] || {}) };
  }
  return fusion;
}

// --- Démarrage : propose de reprendre un brouillon de saisie s'il en existe un ---
function initialiser() {
  const brouillon = lireBrouillon();
  if (brouillon && brouillon.data) {
    ui.renderPropositionBrouillon(racine, {
      date: brouillon.sauvegardeLe,
      onReprendre: () => { etat.data = fusionnerAvecDefauts(brouillon.data); etat.ecran = "wizard"; etat.etapeIndex = 0; render(); },
      onIgnorer: () => { supprimerBrouillon(); render(); },
    });
  } else {
    render();
  }
}

initialiser();
