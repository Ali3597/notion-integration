import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dnd_character, dnd_spells, dnd_equipment, dnd_objectives } from "@/lib/schema";

export async function POST() {
  try {
    // Guard idempotent : vérifier les sorts ET le personnage
    const [existingChar, existingSpells] = await Promise.all([
      db.select({ id: dnd_character.id }).from(dnd_character).limit(1),
      db.select({ id: dnd_spells.id }).from(dnd_spells).limit(1),
    ]);
    if (existingChar.length > 0 || existingSpells.length > 0) {
      return NextResponse.json({ ok: true, message: "Déjà initialisé" });
    }

    // ── Personnage ────────────────────────────────────────────────────────────
    await db.insert(dnd_character).values({
      name: "Matshana",
      class: "Magicien",
      subclass: "Nécromancien",
      race: "Humain",
      level: 6,
      background: "Magicien",
      alignment: null,
      personality: "Curieux / fasciné par les mystères / idéaliste / frustré par l'injustice",
      ideals: "En quête de savoir aux prix de tout",
      bonds: null,
      flaws: "Obstiné, rancunier, perdu",
      hp_max: 28,
      hp_current: 28,
      ac: 12,
      speed: 9,
      spell_save_dc: 14,
      spell_attack_bonus: 6,
      spells_prepared_per_day: 9,
      skill_proficiencies: JSON.stringify(["Arcanes", "Religion"]),
      save_proficiencies: JSON.stringify(["Intelligence", "Sagesse"]),
      proficiency_bonus: 3,
      force: 9,
      dexterite: 14,
      constitution: 14,
      intelligence: 17,
      sagesse: 12,
      charisme: 10,
      backstory: `Matshana est un magicien humain spécialisé dans la nécromancie. Ancien élève d'un maître dont la mort reste un mystère, il porte en permanence trois bagues arcaniques héritées de ce dernier — des artefacts qui semblent avoir une volonté propre et amplifient ses pouvoirs magiques. Sa quête de savoir le pousse à explorer les frontières entre la vie et la mort, cherchant à comprendre les secrets de son maître et les liens obscurs qui unissent sa disparition au commerce de la fleur de jeli.

Capacités spéciales :
• Trahison des ténèbres : Ignorer les résistances et immunités nécrotiques des ennemis
• Restauration magique : Récupérer un emplacement de sort au repos court (moitié du niveau de magicien)
• Apprendre un sort : +2 sorts appris par niveau
• Copie de sorts de nécromancie dans le grimoire à moitié prix (or et temps)
• Récolter l'énergie de la vie : quand vous tuez une ou plusieurs créatures avec un sort de niveau 1 ou plus, vous regagnez un nombre de PV égal au double du niveau du sort (ou triple si nécromancie). Ne s'applique pas aux artificiels et morts-vivants.

Maîtrises : Arcanes (+6), Nature (+3), Religion (+6)
Langues : Commun, ZInda
Armes maîtrisées : Dagues, Fléchettes, Fronde, Bâton, Arbalète légère
Jets de sauvegarde maîtrisés : Intelligence (+6), Sagesse (+4)
DD sorts : 14 | Bonus d'attaque sort : +6 | Sorts préparés/jour : 9`,
    });

    // ── Sorts ─────────────────────────────────────────────────────────────────
    const spells = [
      // Niveau 0
      { name: "Main de mage", level: 0, url: "https://www.aidedd.org/dnd/sorts.php?vf=main-de-mage" },
      { name: "Trait de feu", level: 0, url: "https://www.aidedd.org/dnd/sorts.php?vf=trait-de-feu" },
      { name: "Coup de tonnerre", level: 0, url: "https://www.aidedd.org/dnd/sorts.php?vf=coup-de-tonnerre" },
      { name: "Réparation", level: 0, url: "https://www.aidedd.org/dnd/sorts.php?vf=reparation" },
      // Niveau 1
      { name: "Catapulte", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=catapulte" },
      { name: "Détection de la magie", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=detection-de-la-magie" },
      { name: "Feuille morte", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=feuille-morte" },
      { name: "Nappe de brouillard", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=nappe-de-brouillard" },
      { name: "Sommeil", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=sommeil" },
      { name: "Frayeur", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=frayeur" },
      { name: "Simulacre de vie", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=simulacre-de-vie" },
      { name: "Rayon empoisonné", level: 1, url: "https://www.aidedd.org/dnd/sorts.php?vf=rayon-empoisonne" },
      // Niveau 2
      { name: "Cécité/Surdité", level: 2, url: "https://www.aidedd.org/dnd/sorts.php?vf=cecite-surdite" },
      { name: "Bourrasque", level: 2, url: "https://www.aidedd.org/dnd/sorts.php?vf=bourrasque" },
      { name: "Fouet mental de Tasha", level: 2, url: "https://www.aidedd.org/dnd/sorts.php?vf=fouet-mental-de-tasha" },
      { name: "Détection de pensées", level: 2, url: "https://www.aidedd.org/dnd/sorts.php?vf=detection-de-pensees" },
      // Niveau 3
      { name: "Contresort", level: 3, url: "https://www.aidedd.org/dnd/sorts.php?vf=contresort" },
      { name: "Foulée tonitruante", level: 3, url: "https://www.aidedd.org/dnd/sorts.php?vf=foulee-tonitruante" },
      { name: "Animation des morts", level: 3, url: "https://www.aidedd.org/dnd/sorts.php?vf=animation-des-morts" },
      { name: "Malédiction", level: 3, url: "https://www.aidedd.org/dnd/sorts.php?vf=malediction" },
      { name: "Toucher du vampire", level: 3, url: "https://www.aidedd.org/dnd/sorts.php?vf=toucher-du-vampire" },
    ];

    await db.insert(dnd_spells).values(spells);

    // ── Équipement ────────────────────────────────────────────────────────────
    await db.insert(dnd_equipment).values([
      {
        name: "Dague",
        type: "arme",
        description: "1D4P, finesse, légère. Lancer 6/18",
        magical: false,
        equipped: false,
        quantity: 1,
      },
      {
        name: "Les trois bagues arcaniques",
        type: "artefact",
        description: "Trois bagues destinées aux doigts du milieu, gravées de runes complexes et de symboles liés à la nature. Elles appartenaient au maître. Elles canalisent et amplifient la magie — et semblent avoir une volonté propre.",
        magical: true,
        equipped: true,
        quantity: 1,
        notes: "Les bagues amplifient les pouvoirs magiques",
      },
      {
        name: "Pactage érudit",
        type: "artefact",
        description: "Capacité spéciale du sous-archétype nécromancien",
        magical: true,
        equipped: false,
        quantity: 1,
      },
      {
        name: "Grimoire",
        type: "artefact",
        description: "Grimoire du magicien contenant tous ses sorts",
        magical: false,
        equipped: false,
        quantity: 1,
      },
      {
        name: "Cape +1 CA +1 aux jets de sauvegarde",
        type: "armure",
        description: "Cape magique conférant +1 en Classe d'Armure et +1 aux jets de sauvegarde",
        magical: true,
        equipped: true,
        quantity: 1,
      },
    ]);

    // ── Objectifs ─────────────────────────────────────────────────────────────
    await db.insert(dnd_objectives).values([
      {
        title: "Résoudre le mystère de la mort du maître",
        description: "Comprendre les circonstances exactes de la mort du maître et identifier les responsables.",
        category: "principal",
        status: "En cours",
      },
      {
        title: "Élucider les secrets des bagues",
        description: "Comprendre l'origine et les véritables pouvoirs des trois bagues arcaniques héritées du maître.",
        category: "mystère",
        status: "En cours",
      },
      {
        title: "Évoluer dans le lien avec les esprits",
        description: "Développer la connexion avec le monde des esprits et maîtriser les aspects nécromantiques de la magie.",
        category: "principal",
        status: "En cours",
      },
      {
        title: "Comprendre le lien entre la mort du maître et le commerce de la fleur de jeli",
        description: "Investiguer la connexion entre la disparition du maître et le mystérieux trafic de fleur de jeli.",
        category: "mystère",
        status: "En cours",
      },
      {
        title: "Élucider les liens du maître avec Amos Nir et Nargis Rubia",
        description: "Découvrir la nature des relations entre le maître, Amos Nir et Nargis Rubia, et leur rôle éventuel dans sa mort.",
        category: "mystère",
        status: "En cours",
      },
    ]);

    return NextResponse.json({ ok: true, message: "Données initialisées avec succès" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur lors de l'initialisation" }, { status: 500 });
  }
}
