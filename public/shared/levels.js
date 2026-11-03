// TANDEM — niveaux. Cases de 32 px ; x = 0 à gauche, y = 0 en haut. La taille varie d'un niveau à l'autre (voir `size`).
// Le cadre (murs, plafond, sol) est posé automatiquement. Avec ground() : 3 lignes de sol, on marche sur la ligne H-4.
//
// Repères physiques (mesurés par test/physics.test.js) :
//   - un saut seul monte de 85 px (2,67 cases) : on franchit un mur de 2 cases, pas de 3 ;
//   - l'un sur la tête de l'autre : mur de 3 cases ;
//   - SAUT EN CHAÎNE (le joueur du bas saute, celui du haut saute au bon moment) :
//         corniche de 4 cases = 23 ticks de marge · 5 cases = 19 ticks · 6 cases = 11 ticks · 7 cases = impossible ;
//   - TREMPLIN : un saut depuis un tremplin monte de 6,08 cases ; en chaîne (le haut saute vers le sommet), jusqu'à ~8,7 cases ;
//   - un saut franchit ~4,75 cases de vide (4 cases : il faut décoller à moins d'une case du bord).
// Légende : voir shared/sim.js
(function (root) {
  'use strict';

  // size = [colonnes, lignes] ; draw reçoit des outils de dessin et la taille
  function make(ch, name, hint, draw, cfg, size) {
    const [W, H] = size || [30, 15];
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const rect = (x, y, w, h, c = '#') => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[y + j][x + i] = c; };
    const put = (x, y, c) => { g[y][x] = c; };
    rect(0, 0, W, 1); rect(0, H - 1, W, 1); rect(0, 0, 1, H); rect(W - 1, 0, 1, H);
    // sol épais (3 lignes) ; fosse = trou avec des pics au fond (et, si on veut, un pont sur la 1re ligne)
    const ground = (x0, x1) => rect(x0, H - 3, x1 - x0 + 1, 3, '#');
    const pit = (x0, x1, bridge) => { for (let x = x0; x <= x1; x++) { put(x, H - 3, bridge || '.'); put(x, H - 2, '.'); put(x, H - 1, '^'); } };
    draw({ rect, put, ground, pit, W, H, walk: H - 4 });
    return { name, hint, ch, rows: g.map((r) => r.join('')), cfg: cfg || {}, size: [W, H] };
  }
  const ground = (rect, x0, x1) => rect(x0, 12, x1 - x0 + 1, 3, '#');
  const gap = (put, x0, x1, bridge) => { for (let x = x0; x <= x1; x++) { put(x, 12, bridge); put(x, 13, '.'); put(x, 14, '^'); } };

  const CHAPTERS = [
    { name: 'Duo', sub: 'Se porter, se compléter', theme: 'meadow' },
    { name: 'Cloches', sub: 'Frapper, attendre, traverser', theme: 'arcane' },
    { name: 'Élan', sub: 'Ressorts, tapis et dalles qui lâchent', theme: 'sky' },
    { name: 'Cadence', sub: 'Portails, rythme et précision', theme: 'forge' },
    { name: 'Souffle', sub: 'Courants d’air et interrupteurs', theme: 'ice' },
    { name: 'Mécanismes', sub: 'Bascules, relais et ruines', theme: 'ruins' },
    { name: 'Cosmos', sub: 'Tout ce que vous savez, en plus haut', theme: 'space' },
  ];

  const LEVELS = [
    /* ================= Chapitre 1 : Duo ================= */
    make(0, 'Courte-échelle',
      'Trois épreuves. Un mur de 3 cases : montez sur la tête de l’autre, la plaque en haut ouvre la grille pour celui d’en bas. Une fosse. Puis un mur de 4 cases : le joueur du bas saute, celui du haut saute juste après.',
      ({ rect, put, ground, pit }) => {
        ground(1, 42); pit(19, 21);
        put(3, 11, '2'); put(5, 11, '1');
        rect(12, 9, 2, 1, '#'); rect(12, 10, 2, 2, 'A'); put(12, 8, 'a');      // mur de 3 cases, grille dans le mur, plaque dessus
        put(24, 11, 'F');
        rect(30, 8, 2, 1, '#'); rect(30, 9, 2, 3, 'B'); put(30, 7, 'b');       // mur de 4 cases : saut en chaîne (23 ticks)
        rect(39, 10, 1, 2, 'D'); rect(41, 10, 1, 2, 'D');
      }, {}, [44, 15]),

    make(0, 'Verrous croisés',
      'Deux couloirs, deux joueurs. Ta plaque ouvre la grille de l’autre, et la sienne ouvre la tienne. Les grilles se referment vite : agissez ensemble, puis courez. Les pics sont plus larges que dans les niveaux précédents.',
      ({ rect, put }) => {
        rect(1, 7, 40, 1, '#');                            // plancher du couloir du haut
        put(2, 6, '1'); put(2, 13, '2');
        put(5, 6, 'a'); rect(9, 8, 1, 6, 'A');             // plaque en haut → grille du couloir du bas
        put(5, 13, 'b'); rect(9, 1, 1, 6, 'B');            // plaque en bas  → grille du couloir du haut
        put(17, 13, 'c'); rect(27, 1, 1, 6, 'C');          // plaque du couloir du bas → 2e grille du haut
        rect(12, 6, 3, 1, '^'); rect(21, 6, 3, 1, '^'); rect(31, 6, 3, 1, '^');    // pics en haut
        rect(13, 13, 3, 1, '^'); rect(21, 13, 3, 1, '^'); rect(29, 13, 3, 1, '^'); // pics en bas
        rect(37, 5, 1, 2, 'D'); rect(37, 12, 1, 2, 'D');
      }, { latch: { 1: 130, 2: 130, 3: 0 } }, [42, 15]),

    make(0, 'Marches fantômes',
      'Les marches bleues n’existent que tant qu’une plaque est tenue. Celui qui la tient reste en bas ; l’autre monte sonner la voie. Puis on inverse : l’un tient dans sa porte, l’autre grimpe l’escalier vert jusqu’à la sienne.',
      ({ rect, put, ground }) => {
        ground(1, 32);
        put(2, 20, '2'); put(5, 20, '1'); put(3, 20, 'a');
        // escalier fantôme n°1 (groupe 1) : marches de 2 cases, chacune une case plus haute
        rect(6, 19, 2, 1, 'X'); rect(10, 18, 2, 1, 'X'); rect(14, 17, 2, 1, 'X'); rect(18, 16, 2, 1, 'X'); rect(22, 15, 2, 1, 'X');
        rect(26, 14, 7, 1, '#');                                // corniche (7 cases au-dessus du sol)
        put(27, 13, 'c');                                       // plaque de la corniche → grille C au sol
        rect(28, 15, 1, 6, 'C');                                // grille : la salle de la porte du bas
        rect(12, 20, 2, 1, '^'); rect(17, 20, 2, 1, '^'); rect(22, 20, 2, 1, '^');
        put(31, 19, 'D'); put(31, 20, 'H');                      // porte du bas, qui contient la plaque du groupe 2
        // escalier fantôme n°2 (groupe 2) : de la corniche vers le haut de la tour
        rect(22, 13, 2, 1, 'Y'); rect(18, 12, 2, 1, 'Y'); rect(14, 11, 2, 1, 'Y'); rect(10, 10, 2, 1, 'Y'); rect(6, 9, 2, 1, 'Y');
        rect(1, 8, 4, 1, '#'); rect(2, 6, 1, 2, 'D');
      }, { latch: { 3: 260 } }, [34, 24]),

    /* ================= Chapitre 2 : Cloches ================= */
    make(1, 'Première cloche',
      'Frapper une cloche par-dessous fait apparaître un pont pendant quelques secondes. La première est trop haute : courte-échelle. Aux gouffres suivants, la cloche est trop loin du pont : l’un frappe, l’autre court, puis on inverse. La dernière est tout en haut : saut en chaîne.',
      ({ rect, put, ground, pit }) => {
        ground(1, 60); pit(11, 19, 'M'); pit(28, 36, 'N'); pit(45, 53, 'O');
        put(3, 11, '2'); put(5, 11, '1');
        put(5, 7, 'u');                                             // 4 cases au-dessus du sol : impossible seul
        put(21, 8, 'v'); put(38, 8, 'v');                           // une cloche sur chaque rive du 2e gouffre (à portée d’un seul joueur)
        put(41, 6, 'w');                                            // 5 cases au-dessus du sol : saut en chaîne
        put(24, 11, 'F'); put(42, 11, 'F');
        rect(57, 10, 1, 2, 'D'); rect(59, 10, 1, 2, 'D');
      }, { bell: { 1: { dur: 300 }, 2: { dur: 105 }, 3: { dur: 170 } } }, [62, 15]),

    make(1, 'Les sas',
      'Les cloches ouvrent les murs au lieu de poser des ponts. Ils se referment vite : frappez, puis courez tous les deux. La deuxième cloche pose un pont au-dessus d’un gouffre ; la troisième est tout en haut.',
      ({ rect, put, ground, pit }) => {
        ground(1, 52); pit(24, 30, 'N');
        put(3, 11, '2'); put(5, 11, '1');
        put(9, 7, 'u'); rect(17, 1, 1, 11, 'M');                    // mur-porte n°1 (cloche à 4 cases du sol)
        put(21, 7, 'v');                                            // pont n°2 au-dessus du gouffre
        put(36, 6, 'w'); rect(44, 1, 1, 11, 'O');                   // mur-porte n°3 (cloche à 5 cases : saut en chaîne)
        put(19, 11, 'F'); put(34, 11, 'F');
        rect(48, 10, 1, 2, 'D'); rect(50, 10, 1, 2, 'D');
      }, { bell: { 1: { dur: 130, door: true }, 2: { dur: 140 }, 3: { dur: 100, door: true } } }, [54, 15]),

    make(1, 'Le clocher',
      'Chaque cloche fait surgir un escalier pour quelques secondes… et il faut le grimper avant qu’il ne s’efface. La 1re cloche demande une courte-échelle, la 2e un saut en chaîne, la 3e un saut en chaîne depuis le tremplin.',
      ({ rect, put, ground }) => {
        ground(1, 28);
        put(3, 26, '2'); put(5, 26, '1');
        put(3, 22, 'u');                                            // cloche n°1, 4 cases au-dessus du sol
        rect(7, 25, 2, 1, 'M'); rect(11, 23, 2, 1, 'M');            // escalier 1 : marches de 2 cases de haut
        rect(15, 21, 14, 1, '#');                                   // plate-forme 1 (6 cases au-dessus du sol)
        put(22, 15, 'v');                                           // cloche n°2, 5 cases au-dessus de la plate-forme 1
        rect(11, 19, 2, 1, 'N'); rect(7, 17, 2, 1, 'N');           // escalier 2, vers la gauche
        rect(1, 15, 4, 1, '#'); put(2, 15, 'T');                    // plate-forme 2, avec un tremplin
        put(2, 6, 'w');                                             // cloche n°3, 8 cases au-dessus du tremplin
        rect(7, 13, 2, 1, 'O'); rect(11, 11, 2, 1, 'O');            // escalier 3, vers la droite
        rect(15, 9, 14, 1, '#');                                    // plate-forme 3, tout en haut
        rect(20, 7, 1, 2, 'D'); rect(25, 7, 1, 2, 'D');
        put(24, 20, 'F'); put(4, 14, 'F'); put(17, 8, 'F');          // points de retour à chaque étage
      }, { bell: { 1: { dur: 200 }, 2: { dur: 230 }, 3: { dur: 230 } }, flagOrder: [2, 1, 0] }, [30, 30]),

    /* ================= Chapitre 3 : Élan ================= */
    make(2, 'Tremplin',
      'Le tremplin propulse à 6 cases de haut et franchit même un gouffre de 6 cases. Pour la corniche du bout, trop haute pour un seul : le joueur du bas saute depuis le tremplin, celui du haut saute vers le sommet de son vol.',
      ({ rect, put, ground, pit }) => {
        ground(1, 44); pit(23, 28);
        put(3, 18, '2'); put(5, 18, '1');
        put(8, 19, 'T');                                             // tremplin vers le mur
        rect(11, 15, 2, 1, '#'); rect(11, 16, 2, 3, 'A'); put(11, 14, 'a');    // mur de 5 cases : le tremplin suffit, la plaque ouvre la grille d’en bas
        put(22, 19, 'T');                                            // tremplin au bord du gouffre de 6 cases
        put(15, 18, 'F');
        put(33, 19, 'T');                                            // tremplin de la grande corniche
        rect(35, 11, 8, 1, '#'); put(36, 10, 'b');                  // corniche à 8 cases du sol : saut en chaîne depuis le tremplin
        rect(40, 12, 1, 7, 'B');                                     // grille entre le pied de la corniche et la porte du bas
        rect(42, 9, 1, 2, 'D'); rect(43, 17, 1, 2, 'D');
      }, {}, [46, 22]),

    make(2, 'Pont de verre',
      'Les dalles de verre se brisent peu après qu’on les a foulées, puis se reforment. L’un traverse jusqu’à la plaque du bout, qui ouvre la grille du départ ; il doit la tenir pendant que l’autre passe le mur, puis traverse à son tour. Ensuite, deux gouffres de 4 cases.',
      ({ rect, put, ground, pit }) => {
        ground(1, 54);
        rect(9, 1, 1, 11, 'A');                                      // mur-grille du départ (ouvert par la plaque du bout du pont)
        put(3, 11, '2'); put(12, 11, '1');                           // le joueur 2 reste à gauche du mur, le joueur 1 est déjà au pied du pont
        for (let x = 14; x <= 33; x++) { put(x, 12, 'f'); put(x, 13, '.'); put(x, 14, '^'); }
        for (const x of [19, 20, 25, 29, 30]) put(x, 12, '.');       // trous à sauter
        put(36, 11, 'a'); put(38, 11, 'F');
        pit(41, 44); pit(47, 50);                                    // deux gouffres de 4 cases, un îlot de 2 cases entre
        rect(52, 10, 1, 2, 'D'); rect(54, 10, 1, 2, 'D');
      }, { frag: { delay: 24, restore: 100 }, latch: { 1: 100 } }, [56, 15]),

    /* ================= Chapitre 4 : Cadence ================= */
    make(3, 'Chambre forte',
      'Deux coffres scellés, une seule entrée : les portails. Le portail du premier est sur une corniche trop haute (saut en chaîne) ; il mène à une porte posée sur une plaque, qui ouvre la grille pour l’autre. Le portail du second est encore plus haut… mais il y a un tremplin.',
      ({ rect, put, ground, pit }) => {
        ground(1, 44); pit(10, 13);
        put(3, 12, '2'); put(5, 12, '1');
        rect(19, 9, 2, 1, '#'); put(19, 8, 'm');                    // corniche à 4 cases du sol, portail du coffre n°1
        rect(24, 1, 1, 12, 'A');                                    // grille (ouverte par la plaque du coffre n°1)
        put(22, 12, 'F');
        put(27, 13, 'T');                                           // tremplin
        rect(31, 8, 2, 1, '#'); put(31, 7, 'k');                    // corniche à 5 cases du sol, portail du coffre n°2
        // coffre n°1 (au-dessus du départ) : portail de sortie + porte qui contient la plaque
        rect(3, 2, 8, 1, '#'); rect(3, 8, 8, 1, '#'); rect(3, 3, 1, 5, '#'); rect(10, 3, 1, 5, '#');
        put(5, 7, 'm'); put(8, 7, 'G');
        // coffre n°2 (au-dessus de la fin du couloir) : portail + porte
        rect(35, 2, 9, 1, '#'); rect(35, 9, 9, 1, '#'); rect(35, 3, 1, 6, '#'); rect(43, 3, 1, 6, '#');
        put(37, 8, 'k'); put(41, 8, 'D');
      }, {}, [46, 16]),

    make(3, 'Pulsations',
      'Les pierres jaunes et bleues apparaissent à tour de rôle, au rythme d’une horloge : sautez de l’une à l’autre juste au bon moment (écarts de 4 cases !). Sur l’îlot, une cloche trop haute pour un seul : courte-échelle, puis courez sur le pont.',
      ({ rect, put, ground, pit }) => {
        ground(1, 6);
        for (let x = 7; x <= 31; x++) { put(x, 13, '.'); put(x, 14, '.'); put(x, 15, '^'); }
        rect(8, 13, 2, 1, 'r'); rect(14, 13, 2, 1, 's'); rect(20, 13, 2, 1, 'r'); rect(26, 13, 2, 1, 's');
        ground(32, 37); pit(38, 47, 'M'); ground(48, 56);
        put(3, 12, '2'); put(5, 12, '1');
        put(34, 8, 'u');                                              // 4 cases au-dessus de l’îlot
        put(33, 12, 'F');
        rect(52, 11, 1, 2, 'D'); rect(55, 11, 1, 2, 'D');
      }, { rhythm: { period: 90, on: 44 }, bell: { 1: { dur: 200 } } }, [58, 16]),

    make(3, 'Métronome',
      'Le dernier. Des tapis qui vous ramènent en arrière ; un mur de 6 cases (saut en chaîne : la marge est d’une dizaine d’images seulement) avec une plaque à son sommet ; cinq pierres qui battent vite ; enfin, sur l’îlot, une cloche trop haute pour un seul, et un pont qui ne dure pas.',
      ({ rect, put, ground, pit }) => {
        const belt = (x0, x1) => { rect(x0, 17, x1 - x0 + 1, 3, '#'); for (let x = x0; x <= x1; x++) put(x, 17, '<'); };
        ground(1, 5); belt(6, 10); pit(11, 13); belt(14, 18); pit(19, 21); belt(22, 26); ground(27, 40);
        put(3, 16, '2'); put(5, 16, '1');
        put(30, 16, 'F');
        rect(36, 11, 2, 1, '#'); rect(36, 12, 2, 5, 'B'); put(36, 10, 'b');          // mur de 6 cases : saut en chaîne serré
        pit(41, 65);                                                                 // champ de pics : 5 pierres qui battent
        rect(43, 17, 2, 1, 'r'); rect(48, 17, 2, 1, 's'); rect(53, 17, 2, 1, 'r'); rect(58, 17, 2, 1, 's'); rect(63, 17, 2, 1, 'r');
        ground(66, 71); put(69, 16, 'F');
        put(68, 12, 'u');                                                            // cloche : un joueur monte sur l’autre
        pit(72, 80, 'M'); ground(81, 90);
        rect(84, 15, 1, 2, 'D'); rect(87, 15, 1, 2, 'D');
      }, { rhythm: { period: 80, on: 44 }, bell: { 1: { dur: 180 } }, belt: { speed: 2 }, zoom: 0.8 }, [92, 20]),

    /* ================= Chapitre 5 : Souffle ================= */
    make(4, 'Premier souffle',
      'Un courant d’air vous emporte vers le haut tant que la plaque voisine est tenue : l’un reste sur la plaque, l’autre s’envole. Là-haut, l’interrupteur souffle un second courant pour celui qui est resté. Puis une fosse, des pics, et un dernier mur de 4 cases.',
      ({ rect, put, ground, pit }) => {
        ground(1, 60); pit(10, 12);
        put(3, 12, '2'); put(5, 12, '1');
        put(15, 12, 'F');
        put(18, 12, 'a');                                         // plaque : tient le courant P
        rect(23, 3, 1, 10, 'Q'); rect(24, 3, 1, 10, 'P');          // courants : Q (interrupteur), P (plaque)
        rect(25, 5, 2, 8, '#');                                    // mur de 8 cases : aucun saut, même en chaîne, n’y suffit
        rect(27, 5, 13, 2, '#');                                   // grand balcon
        put(28, 4, 'y');                                           // interrupteur : souffle Q (rebascule quand on repasse dessus)
        put(30, 4, 'F');
        rect(34, 4, 3, 1, '^');                                    // pics sur le balcon
        // mur de 4 cases : saut en chaîne (23 ticks), plaque au sommet, grille dans le mur
        rect(48, 9, 2, 1, '#'); rect(48, 10, 2, 3, 'C'); put(48, 8, 'c');
        put(44, 12, 'F');
        rect(56, 10, 1, 3, 'D'); rect(59, 10, 1, 3, 'D');
      }, {}, [62, 16]),

    make(4, 'Cloches d’altitude',
      'Des cloches à 8 cases de haut : seul un courant d’air peut y porter. L’un tient la plaque, l’autre s’envole et sonne ; le pont apparaît le temps que le premier coure. Il y a mieux à faire que se presser : trois fosses, dont la dernière a deux cloches.',
      ({ rect, put, ground, pit }) => {
        ground(1, 17); pit(18, 28, 'M');                            // fosse de 11 cases : pont du groupe 1
        put(3, 13, '2'); put(5, 13, '1');
        put(9, 13, 'F');
        put(13, 13, 'a'); rect(16, 6, 1, 8, 'P'); put(16, 5, 'u');   // plaque, courant, cloche
        ground(29, 52); put(31, 13, 'F');
        // mur de 5 cases : saut en chaîne (19 ticks)
        rect(40, 9, 2, 1, '#'); rect(40, 10, 2, 4, 'C'); put(40, 8, 'c');
        put(44, 13, 'F');
        ground(53, 60); pit(61, 70, 'N'); ground(71, 74); pit(75, 84, 'O'); ground(85, 101);
        put(56, 13, 'b'); rect(58, 6, 1, 8, 'Q'); put(58, 5, 'v');   // 1re moitié : cloche v → pont N
        rect(72, 6, 1, 8, 'Q'); put(72, 5, 'w');                     // îlot : même plaque, cloche w → pont O
        put(87, 13, 'F');
        rect(97, 11, 1, 3, 'D'); rect(100, 11, 1, 3, 'D');
      }, { bell: { 1: { dur: 150 }, 2: { dur: 330 }, 3: { dur: 270 } } }, [103, 17]),

    make(4, 'Ascenseur',
      'Une tour de trois étages. À chaque étage, l’un tient la plaque pendant que l’autre s’envole dans le courant ; là-haut, l’interrupteur souffle un second courant pour celui qui est resté. Les étages ont leurs pièges (pics, dalles qui lâchent, pierres rythmées). Au sommet, un mur de 5 cases.',
      ({ rect, put, ground, pit, H }) => {
        ground(1, 34);
        pit(10, 13); pit(17, 24, 'f');                              // étage 0 : fosse, puis pont de dalles fragiles
        put(3, 29, '2'); put(5, 29, '1'); put(8, 29, 'F'); put(27, 29, 'F');
        put(29, 29, 'a'); rect(33, 19, 1, 11, 'P'); rect(34, 19, 1, 11, 'Q');   // plaque a ; courant P (plaque), courant Q (interrupteur)
        rect(1, 21, 32, 2, '#');                                    // dalle de l’étage 1
        rect(16, 21, 4, 1, '.'); rect(16, 22, 4, 1, '^');           // trou à pics (étage 1)
        put(30, 20, 'y'); put(27, 20, 'F'); put(12, 20, 'F');
        put(7, 20, 'c'); rect(1, 10, 1, 11, 'R'); rect(2, 10, 1, 11, 'Q');      // plaque c ; courant R (plaque), courant Q
        rect(3, 12, 32, 2, '#');                                    // dalle de l’étage 2
        rect(10, 12, 19, 1, '.'); rect(10, 13, 19, 1, '^');         // grand trou à pics : pierres rythmées
        put(11, 12, 'r'); put(12, 12, 'r'); put(17, 12, 's'); put(18, 12, 's'); put(23, 12, 'r'); put(24, 12, 'r');
        put(4, 11, 'y'); put(7, 11, 'F');
        rect(30, 7, 5, 5, '#'); rect(29, 6, 1, 6, 'Q'); put(31, 6, 'y');         // mur de 5 cases, courant Q3 au pied, interrupteur sur la corniche
        rect(32, 4, 1, 3, 'D'); rect(34, 4, 1, 3, 'D');
      }, { rhythm: { period: 90, on: 44 } }, [36, 33]),

    /* ================= Chapitre 6 : Mécanismes ================= */
    make(5, 'Allée des pics',
      'Des tunnels trop bas pour sauter par-dessus : les pics sortent en cadence (ils clignotent juste avant). Traversez quand ils rentrent. Entre les deux allées, un mur de 5 cases : saut en chaîne, plaque en haut, grille dans le mur.',
      ({ rect, put, ground }) => {
        ground(1, 72);
        put(3, 11, '2'); put(5, 11, '1');
        rect(8, 8, 31, 2, '#');                                    // plafond du tunnel : hauteur de 2 cases, impossible de sauter par-dessus les pics
        rect(10, 11, 4, 1, 'e'); rect(19, 11, 4, 1, 'E'); rect(28, 11, 4, 1, 'e');
        put(16, 11, 'F'); put(25, 11, 'F');
        put(36, 11, 'F');
        // mur de 5 cases (saut en chaîne, 19 ticks), grille dans le mur
        rect(44, 7, 2, 1, '#'); rect(44, 8, 2, 4, 'C'); put(44, 6, 'c');
        put(41, 11, 'F');
        // seconde allée : poches de 3 cases seulement
        rect(50, 8, 15, 2, '#');
        rect(52, 11, 4, 1, 'E'); rect(60, 11, 4, 1, 'e');
        put(58, 11, 'F');
        rect(68, 9, 1, 3, 'D'); rect(71, 9, 1, 3, 'D');
      }, { rspike: { period: 110, on: 40 } }, [74, 15]),

    make(5, 'Prêts ? Partez !',
      'Chaque salle a deux plaques, loin l’une de l’autre : il faut les tenir ENSEMBLE pour ouvrir la grille, qui ne reste ouverte que quelques secondes après qu’on les a lâchées. Posez-vous, ouvrez, puis courez tous les deux. La dernière salle se court à contre-sens des tapis.',
      ({ rect, put, ground, pit }) => {
        ground(1, 91);
        put(3, 11, '2'); put(5, 11, '1');
        // salle 1 : une plaque de chaque côté d’une fosse
        put(8, 11, 'a'); put(22, 11, 'a'); pit(13, 16); rect(27, 1, 1, 11, 'A');
        put(30, 11, 'F');
        // salle 2 : une plaque sur une corniche à 4 cases (courte-échelle), l’autre au sol
        rect(38, 8, 2, 1, '#'); put(38, 7, 'b'); put(50, 11, 'b'); rect(56, 1, 1, 11, 'B');
        put(34, 11, 'F');
        put(58, 11, 'F');
        // salle 3 : deux plaques côte à côte, puis les tapis à contre-sens
        put(60, 11, 'c'); put(62, 11, 'c');
        for (let x = 66; x <= 71; x++) put(x, 12, '<');
        pit(72, 74);
        for (let x = 75; x <= 80; x++) put(x, 12, '<');
        pit(81, 83); rect(86, 1, 1, 11, 'C');
        put(84, 11, 'F');
        rect(89, 9, 1, 3, 'D'); rect(91, 9, 1, 3, 'D');
      }, { latch: { 1: 190, 2: 190, 3: 350 }, belt: { speed: 2 } }, [93, 15]),

    make(5, 'Chacun son couloir',
      'Deux couloirs superposés, chacun avec ses pièges : pics rythmés en haut, dalles fragiles et tapis en bas. L’interrupteur de l’un ouvre la grille de l’autre. Tout à la fin, celui du haut doit encore lever la dernière grille du bas.',
      ({ rect, put, ground, pit }) => {
        ground(1, 82);
        rect(1, 7, 82, 2, '#');                                    // séparation entre les deux couloirs
        put(3, 6, '1'); put(3, 14, '2');
        // ---- couloir du haut : tunnel de pics, puis pierres rythmées au-dessus des pics, puis le levier du courant
        rect(8, 4, 23, 2, '#');                                    // tunnel à 1 case de haut
        rect(10, 6, 4, 1, 'e'); rect(19, 6, 4, 1, 'E');
        put(33, 6, 'x'); rect(38, 1, 1, 6, 'B');                   // interrupteur du haut → grille A du bas ; grille B du haut
        rect(42, 7, 19, 1, '.'); rect(42, 8, 19, 1, '^');
        put(43, 7, 'r'); put(44, 7, 'r'); put(49, 7, 's'); put(50, 7, 's'); put(55, 7, 'r'); put(56, 7, 'r');
        put(70, 6, 'z');                                           // dernier interrupteur du haut → grille C du bas
        rect(71, 4, 6, 2, '#'); rect(73, 6, 4, 1, 'e');
        rect(79, 4, 1, 3, 'D');
        // ---- couloir du bas : pont de dalles fragiles, puis tapis à contre-sens, puis le pied du courant
        pit(10, 18, 'f');
        put(33, 14, 'y'); rect(38, 9, 1, 6, 'A');                  // interrupteur du bas → grille B du haut ; grille A du bas
        for (let x = 40; x <= 48; x++) put(x, 15, '<');
        pit(49, 51);
        for (let x = 52; x <= 60; x++) put(x, 15, '<');
        rect(67, 9, 1, 6, 'C');
        pit(72, 74);
        rect(79, 12, 1, 3, 'D');
      }, { rhythm: { period: 90, on: 44 }, rspike: { period: 110, on: 40 }, belt: { speed: 2 } }, [84, 18]),

    /* ================= Chapitre 7 : Cosmos ================= */
    make(6, 'Orbite',
      'Un pont n’apparaît que si quelqu’un sonne une cloche à 9 cases de haut : seul le ressort, avec le saut en chaîne, y porte. Ensuite, le pont ne dure pas : courez, puis traversez un tunnel de pics, une fosse de 6 cases (ressort), et un second champ de pierres qui battent la mesure.',
      ({ rect, put, ground, pit }) => {
        ground(1, 116);
        put(3, 12, '2'); put(5, 12, '1');
        // 1. pierres rythmées au-dessus des pics
        pit(10, 28);
        put(11, 13, 'r'); put(12, 13, 'r'); put(17, 13, 's'); put(18, 13, 's'); put(23, 13, 'r'); put(24, 13, 'r');
        put(31, 12, 'F');
        // 2. cloche à 9 cases : ressort + saut en chaîne, puis un pont qui ne dure pas au-dessus d’une longue fosse
        put(37, 13, 'T'); put(37, 2, 'u');
        put(34, 12, 'F');
        pit(41, 52, 'M');
        put(54, 12, 'F');
        // 3. tunnel de pics rythmés
        rect(55, 9, 17, 2, '#');
        rect(58, 12, 4, 1, 'e'); rect(66, 12, 4, 1, 'E');
        put(73, 12, 'F');
        // 4. ressort : une fosse de 6 cases, infranchissable sans élan
        put(76, 13, 'T'); pit(77, 82);
        put(85, 12, 'F');
        // 5. second champ de pierres
        pit(90, 108);
        put(91, 13, 'r'); put(92, 13, 'r'); put(97, 13, 's'); put(98, 13, 's'); put(103, 13, 'r'); put(104, 13, 'r');
        rect(112, 10, 1, 3, 'D'); rect(115, 10, 1, 3, 'D');
      }, { rhythm: { period: 90, on: 44 }, rspike: { period: 110, on: 40 }, bell: { 1: { dur: 240 } } }, [118, 16]),

    make(6, 'Funambules',
      'Des dalles qui lâchent sous vos pieds, un ressort qui vous jette sur un chemin suspendu, des pics qui battent la mesure dans un tunnel trop bas, puis deux murs à franchir en chaîne. Ne vous arrêtez jamais sur une dalle fragile.',
      ({ rect, put, ground, pit }) => {
        ground(1, 96);
        put(3, 11, '2'); put(5, 11, '1');
        // 1. long pont de dalles fragiles
        pit(10, 21, 'f');
        put(23, 11, 'F');
        // 2. ressort vers un chemin suspendu : tunnel de pics rythmés
        put(25, 12, 'T'); pit(26, 50);
        rect(28, 7, 23, 1, '#');
        put(30, 6, 'F');
        rect(33, 4, 17, 2, '#');
        rect(35, 6, 4, 1, 'e'); rect(43, 6, 4, 1, 'E');
        put(53, 11, 'F');
        // 3. mur de 5 cases : saut en chaîne, plaque en haut, grille dans le mur
        rect(58, 7, 2, 1, '#'); rect(58, 8, 2, 4, 'C'); put(58, 6, 'c');
        put(55, 11, 'F');
        put(62, 11, 'F');
        // 4. second pont fragile
        pit(64, 75, 'f');
        put(77, 11, 'F');
        // 5. mur de 4 cases : un interrupteur en haut ouvre la grille du mur
        rect(84, 8, 2, 1, '#'); rect(84, 9, 2, 3, 'B'); put(84, 7, 'y');
        put(81, 11, 'F');
        rect(92, 9, 1, 3, 'D'); rect(95, 9, 1, 3, 'D');
      }, { rspike: { period: 110, on: 40 }, frag: { delay: 26, restore: 220 } }, [98, 15]),

    make(6, 'Tandem',
      'Le grand final : une ascension en trois étages. En bas, des pierres au-dessus des pics, puis le courant qu’il faut se partager pour monter. Au milieu, des pics, un tunnel rythmé et un long pont de verre. Un dernier ressort vous jette tout en haut, où il reste à franchir les pierres… et à sortir ensemble.',
      ({ rect, put, ground, pit }) => {
        ground(1, 138);
        put(3, 18, '2'); put(5, 18, '1');
        // ---- étage 0 : pierres rythmées au-dessus des pics
        pit(10, 28);
        put(11, 19, 'r'); put(12, 19, 'r'); put(17, 19, 's'); put(18, 19, 's'); put(23, 19, 'r'); put(24, 19, 'r');
        put(31, 18, 'F');
        // ---- montée n°1 : courant tenu par la plaque, courant de l’interrupteur (en haut)
        put(38, 18, 'a');
        rect(43, 9, 1, 10, 'Q'); rect(44, 9, 1, 10, 'P');
        rect(45, 11, 2, 8, '#');
        rect(47, 18, 92, 1, '^');                                    // le vide sous les étages : pics
        // ---- étage 1 : pics, tunnel de pics rythmés, long pont de verre
        rect(47, 11, 50, 2, '#');
        put(48, 10, 'y'); put(50, 10, 'F');
        rect(54, 10, 3, 1, '^');
        put(59, 10, 'F');
        rect(62, 8, 17, 2, '#'); rect(65, 10, 4, 1, 'e'); rect(73, 10, 4, 1, 'E');
        put(80, 10, 'F');
        for (let x = 84; x <= 95; x++) { put(x, 11, 'f'); put(x, 12, '.'); }
        // ---- montée n°2 : ressort vers l’étage 2
        put(97, 11, 'T');
        // ---- étage 2 : dernière série de pierres, puis les portes
        rect(100, 6, 8, 1, '#');
        put(101, 5, 'F');
        rect(108, 6, 19, 1, '.');
        put(109, 6, 'r'); put(110, 6, 'r'); put(115, 6, 's'); put(116, 6, 's'); put(121, 6, 'r'); put(122, 6, 'r');
        rect(127, 6, 12, 1, '#');
        put(129, 5, 'F');
        rect(134, 3, 1, 3, 'D'); rect(137, 3, 1, 3, 'D');
      }, { rhythm: { period: 90, on: 44 }, rspike: { period: 110, on: 40 }, frag: { delay: 26, restore: 220 } }, [140, 22]),
  ];

  // Rappel court affiché en haut de l'écran au début de la partie (l'indice complet est dans le menu)
  const TIPS = [
    'Montez sur la tête de l’autre : la plaque en haut ouvre la grille du bas.',
    'Ta plaque ouvre sa grille, la sienne ouvre la tienne. Agissez ensemble, puis courez.',
    'Les marches bleues n’existent que tant qu’une plaque est tenue.',
    'Frappez la cloche par-dessous : un pont apparaît. Un frappe, l’autre court.',
    'Ici les cloches ouvrent des murs. Frappez, puis courez tous les deux.',
    'Chaque cloche fait surgir un escalier éphémère : grimpez vite.',
    'Le tremplin vous envoie très haut. Pour la corniche : saut en chaîne depuis le tremplin.',
    'Le verre se brise après votre passage. Ne vous arrêtez pas dessus.',
    'Les portails vont par deux. Un portail trop haut : saut en chaîne, ou tremplin.',
    'Sautez de pierre en pierre quand elles apparaissent. Chaque saut doit être tenu.',
    'Tapis, mur de 6 cases, pierres rapides, cloche : tout d’une traite.',
    'Un courant d’air ne souffle que si la plaque est tenue. L’un reste, l’autre s’envole.',
    'Une cloche trop haute : le courant d’air vous y porte. Le pont dure peu : courez.',
    'Montez d’étage en étage : l’un tient la plaque, l’autre s’envole, puis l’interrupteur fait monter le premier.',
    'Les pics sortent en cadence : traversez quand ils sont rentrés, ils clignotent avant de ressortir.',
    'Deux plaques éloignées à tenir ENSEMBLE : la grille reste ouverte peu de temps. Courez !',
    'Chacun son couloir : votre interrupteur ouvre la grille de l’autre. Il faudra aussi lever la dernière grille.',
    'La cloche est trop haut : le ressort et un saut en chaîne. Le pont ne dure pas, courez !',
    'Dalles fragiles : on court sans s’arrêter. Le ressort vous jette sur le chemin suspendu.',
    'Dernier niveau : trois étages à gravir ensemble. Ne vous quittez pas !',
  ];
  LEVELS.forEach((l, i) => { l.tip = TIPS[i] || l.hint; });

  const API = { CHAPTERS, LEVELS, make };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Levels = API;
})(typeof window !== 'undefined' ? window : globalThis);
