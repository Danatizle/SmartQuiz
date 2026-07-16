//juego_alumno.js
document.addEventListener("DOMContentLoaded", () => {


const injectPodiumStyles = () => {

    if (document.getElementById('podiumStylesInjected')) return;

    const cssStyles = `

        .final-view:not(.active) { display: none; }
        .final-view {
            display: flex;
            flex-direction: column;
            justify-content: flex-start; /* Empezar desde arriba */
            align-items: center;
            padding: 40px 15px 80px 15px; /* Padding (más abajo) */
            box-sizing: border-box;
            background-color: #333a4f; /* Fondo oscuro */
            color: white;
            overflow-y: auto; /* Permite scroll */
            text-align: center;
        }
        .final-title {
            font-size: 2.5rem;
            color: #f0c419;
            margin-bottom: 20px;
        }


        .podium-container {
            display: flex;
            justify-content: center;
            align-items: flex-end;
            gap: 10px;
            width: 100%;
            max-width: 500px;
            margin: 10px auto;
            min-height: 180px;
        }
        .podium-item {
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 15px 10px;
            width: 30%;
            color: white;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            order: 2;
        }
        .podium-item .position { font-size: 2rem; font-weight: 900; margin-bottom: 8px; }
        .podium-item .name { font-size: 1.1rem; font-weight: 700; word-break: break-all; }
        .podium-item .score { font-size: 0.9rem; color: #f0c419; margin-top: 5px; }

        .podium-item.first-place {
            height: 160px; background: #f0c419; color: #333; border-color: #f5d45c; order: 1;
        }
        .podium-item.first-place .score { color: #333; font-weight: 700; }
        .podium-item.second-place {
            height: 120px; background: #c0c0c0; color: #333; border-color: #ddd; order: 0;
        }
        .podium-item.second-place .score { color: #333; }
        .podium-item.third-place {
            height: 90px; background: #cd7f32; color: #fff; border-color: #d89b6a; order: 2;
        }
        .podium-item.third-place .score { color: #fff; }

        /* --- ESTILOS RECOMPENSAS --- */
        .rewards-container {
            margin-top: 25px; width: 100%; max-width: 500px; text-align: left;
            background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px; padding: 15px 20px; box-sizing: border-box;
        }
        .rewards-container.hidden { display: none; }
        .rewards-container h3 {
            font-size: 1.3rem; color: #f0c419; margin-bottom: 15px;
            margin-top: 0; text-align: center;
        }
        .rewards-list { list-style: none; padding: 0; margin: 0; }
        .rewards-list li {
            font-size: 1rem; color: #fff; padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex; align-items: center;
        }
        .rewards-list li:last-child { border-bottom: none; }
        .rewards-list li strong { color: #f0c419; margin-right: 10px; flex-shrink: 0; }
        .rewards-list li span { color: #eee; }

        /* --- ESTILOS "MI PUESTO" Y MARCADOR COMPLETO (NUEVO) --- */
        .my-rank-container, .full-leaderboard-container {
            margin-top: 20px; width: 100%; max-width: 500px; text-align: left;
            background: rgba(0, 0, 0, 0.2); border-radius: 8px; padding: 15px 20px;
            box-sizing: border-box;
        }
        .my-rank-container h4, .full-leaderboard-container h4 {
            font-size: 1.3rem; color: #eee; margin-top: 0; margin-bottom: 15px;
            text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding-bottom: 10px;
        }
        .my-rank-item {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 1.2rem; font-weight: 700;
        }
        .my-rank-item span:nth-child(1) { color: #f0c419; } /* Puesto */
        .my-rank-item span:nth-child(2) { color: #fff; }     /* Nombre */
        .my-rank-item span:nth-child(3) { color: #f0c419; } /* Score */

        .full-leaderboard-list {
            max-height: 250px; overflow-y: auto; padding-right: 10px;
        }
        .leaderboard-row {
            display: flex; justify-content: space-between; padding: 8px 5px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .leaderboard-row.is-me { /* Resaltar al jugador actual */
            background: rgba(240, 196, 25, 0.2);
            border-radius: 4px;
            font-weight: 700;
        }
        .leaderboard-row .rank { color: #aaa; min-width: 30px; }
        .leaderboard-row .name { color: #fff; flex-grow: 1; text-align: left; padding-left: 10px; }
        .leaderboard-row .score { color: #f0c419; font-weight: 700; }

        /* --- BOTONES FINALES --- */
        .final-buttons { margin-top: 30px; }
        .btn-primary {
            background: #6a5af9; color: white; padding: 12px 25px;
            text-decoration: none; border-radius: 5px; font-weight: 700;
        }
    `;
    const styleElement = document.createElement('style');
    styleElement.id = 'podiumStylesInjected'; // ID para no duplicar
    styleElement.type = 'text/css';
    styleElement.innerHTML = cssStyles;
    document.head.appendChild(styleElement);
};


const renderPodium = (marcador) => {
    const podiumContainer = document.getElementById('podium');
    if (!podiumContainer) return;
    podiumContainer.innerHTML = '';
    const top3 = marcador.slice(0, 3);
    const podiumElements = [];

    // Puesto 2
    const p2 = top3[1];
    podiumElements.push(`
        <div class="podium-item second-place">
            <div class="position">2º</div>
            <div class="name">${p2 ? p2.nombre_usuario_partida : '---'}</div>
            <div class="score">${p2 ? p2.puntuacion_total : '---'} pts</div>
        </div>
    `);

    // Puesto 1
    const p1 = top3[0];
    podiumElements.push(`
        <div class="podium-item first-place">
            <div class="position">1º</div>
            <div class="name">${p1 ? p1.nombre_usuario_partida : '---'}</div>
            <div class="score">${p1 ? p1.puntuacion_total : '---'} pts</div>
        </div>
    `);

    // Puesto 3
    const p3 = top3[2];
    podiumElements.push(`
        <div class="podium-item third-place">
            <div class="position">3º</div>
            <div class="name">${p3 ? p3.nombre_usuario_partida : '---'}</div>
            <div class="score">${p3 ? p3.puntuacion_total : '---'} pts</div>
        </div>
    `);

    podiumContainer.innerHTML = podiumElements.join('');
};


const renderRewards = (recompensas) => {
    const rewardsListEl = document.getElementById('rewardsList');
    const rewardsContainer = document.getElementById('rewardsContainer');
    if (!rewardsListEl || !rewardsContainer) return;

    rewardsListEl.innerHTML = '';
    if (!recompensas || recompensas.length === 0) {
        rewardsContainer.classList.add('hidden');
        return;
    }

    rewardsContainer.classList.remove('hidden');
    const puestos = ['🥇 <strong>Primer Lugar:</strong>', '🥈 <strong>Segundo Lugar:</strong>', '🥉 <strong>Tercer Lugar:</strong>'];

    recompensas.slice(0, 3).forEach((descripcion, index) => {
        if(descripcion) { // Solo añadir si hay texto
            const li = document.createElement('li');
            li.innerHTML = `${puestos[index] || ''} <span>${descripcion}</span>`;
            rewardsListEl.appendChild(li);
        }
    });
};


// En juego_alumno.js

const renderFinalRanking = (marcadorCompleto, miId, miPuesto, miScoreRanking, miScoreReal) => {
    // --- 1. Rellenar "Mi Puesto" ---
    const posEl = document.getElementById('myRankPosition');
    const nameEl = document.getElementById('myRankName');
    const scoreEl = document.getElementById('myRankScore');

    if (posEl && nameEl && scoreEl) {
        posEl.textContent = `Puesto: ${miPuesto > 0 ? miPuesto : 'N/A'}`;
        nameEl.textContent = NICKNAME;

        // 🔥 LÓGICA DE VISUALIZACIÓN INTELIGENTE 🔥
        // Si el score del ranking (grupo) es diferente al individual, mostramos ambos.
        if (miScoreReal !== undefined && miScoreRanking !== miScoreReal) {
            scoreEl.innerHTML = `<span style="font-size:0.8em; color:#aaa;">Indiv:</span> ${miScoreReal} <br> <span style="font-size:0.8em; color:#f0c419;">Equipo:</span> ${miScoreRanking}`;
            scoreEl.style.lineHeight = "1.2";
            scoreEl.style.textAlign = "right";
        } else {
            // Modo normal o individual
            scoreEl.textContent = `${miScoreRanking || 0} pts`;
        }
    }

    // --- 2. Rellenar Marcador Completo (Esto queda igual, muestra el ranking global) ---
    const listEl = document.getElementById('fullLeaderboardList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!marcadorCompleto || marcadorCompleto.length === 0) {
        listEl.innerHTML = '<p>No hay marcador disponible.</p>';
        return;
    }

    marcadorCompleto.forEach((jugador, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';

        // En modo grupo, 'jugador.id_participante' no existe en el ranking agrupado,
        // pero podemos resaltar si el puesto coincide con miPuesto
        if ((index + 1) === miPuesto) {
            row.classList.add('is-me');
        }

        row.innerHTML = `
            <span class="rank">${index + 1}.</span>
            <span class="name">${jugador.nombre_usuario_partida}</span>
            <span class="score">${jugador.puntuacion_total} pts</span>
        `;
        listEl.appendChild(row);
    });
};

    // --- ELEMENTOS DE LA UI ---
    const screens = {
        loading: document.getElementById("loadingScreen"),
        question: document.getElementById("questionScreen"),
        feedback: document.getElementById("feedbackScreen"),
        end: document.getElementById("endScreen"),
    };
    const questionCounterEl = document.getElementById("questionCounter");
    const timerEl = document.getElementById("timer");
    const questionTextEl = document.getElementById("questionText");
    const questionImageEl = document.getElementById("questionImage");
    const answerOptionsEl = document.getElementById("answerOptions");
    const feedbackTextEl = document.getElementById("feedbackText");
    const pointsEarnedEl = document.getElementById("pointsEarned");
    const finalScoreEl = document.getElementById("finalScore");

    // --- VARIABLES DE ESTADO DEL JUEGO ---
    let gameState = {};
    let timerInterval;
    let pollTimeout;
    let timeRemaining;
    let questionStartTime;

    // BANDERAS DE CONTROL
    let currentQuestionId = null;
    let hasAnswered = false;
    let feedbackShownForQuestion = false;
    let pendingResultado = null;

    // --- FUNCIONES DE UI ---
    const showScreen = (screenName) => {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        if (screens[screenName]) screens[screenName].classList.add('active');
    };

    const renderQuestion = (pregunta, segundosTranscurridos = 0) => {

        // 1. DETECTAR SI ES UNA PREGUNTA NUEVA
        // Si el ID de la pregunta que llega es igual al que ya tengo, NO hago nada.
        // Esto evita que la pantalla parpadee o el reloj se reinicie cada 3 segundos.
        if (currentQuestionId === pregunta.id_pregunta) {
            return; // Salimos de la función inmediatamente
        }

        // Si llegamos aquí, es porque la pregunta CAMBIÓ
        console.log("Nueva pregunta detectada. Actualizando UI...");
        currentQuestionId = pregunta.id_pregunta;

        // Reiniciar banderas para la nueva pregunta
        hasAnswered = false;
        feedbackShownForQuestion = false;
        pendingResultado = null;

        // 2. ACTUALIZAR TEXTOS E IMAGEN
        // Usamos la protección || para evitar "undefined"
        const textoPregunta = pregunta.texto || "Pregunta...";
        questionTextEl.textContent = textoPregunta;
        questionCounterEl.textContent = `${pregunta.numero || '?'} / ${pregunta.total_preguntas || '?'}`;

        // Validación de imagen
        if (pregunta.media && pregunta.media !== "") {
            questionImageEl.src = pregunta.media;
            questionImageEl.classList.remove('hidden');
        } else {
            questionImageEl.classList.add('hidden');
        }

        // 3. GENERAR BOTONES DE RESPUESTA
        answerOptionsEl.innerHTML = '';
        const shapes = ['triangle', 'diamond', 'circle', 'square'];
        pregunta.respuestas.forEach((respuesta, index) => {
            const option = document.createElement('button');
            option.className = `answer-option shape-${shapes[index % 4]}`;
            option.dataset.id = respuesta.id_respuesta;
            option.innerHTML = `<span>${respuesta.texto_respuesta}</span>`;
            option.addEventListener('click', handleAnswerClick);
            answerOptionsEl.appendChild(option);
        });

        // 4. INICIAR TEMPORIZADOR SINCRONIZADO
        // Calculamos: Tiempo Total (ej: 30s) - Lo que ya pasó en el servidor (ej: 5s) = Restan 25s
        const tiempoRestante = Math.max(0, pregunta.tiempo - segundosTranscurridos);

        console.log(`Reloj: Total ${pregunta.tiempo}s - Pasaron ${segundosTranscurridos}s = Quedan ${tiempoRestante}s`);

        startTimer(tiempoRestante);
        showScreen('question');
    };

    const startTimer = (duration) => {
        clearInterval(timerInterval);
        timeRemaining = duration;
        questionStartTime = Date.now();
        timerEl.textContent = timeRemaining;

        timerInterval = setInterval(() => {
            timeRemaining--;
            timerEl.textContent = timeRemaining;

            // Si el tiempo llega a 0, detener timer
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                // El alumno no muestra feedback todavía; espera orden del profesor
            }
        }, 1000);
    };

    const showFeedback = (resultado) => {
        clearInterval(timerInterval);
        if (feedbackShownForQuestion) return;
        feedbackShownForQuestion = true;

        if (resultado.es_correcta) {
            feedbackTextEl.textContent = "¡Correcto!";
            screens.feedback.classList.remove('incorrect');
            screens.feedback.classList.add('correct');
        } else {
            feedbackTextEl.textContent = "Incorrecto";
            screens.feedback.classList.remove('correct');
            screens.feedback.classList.add('incorrect');
        }

        pointsEarnedEl.textContent = resultado.puntuacion_obtenida || 0;
        showScreen('feedback');
    };

    const showEndScreen = () => {
        showScreen('end');
    };

    // --- COMUNICACIÓN ---
    const handleAnswerClick = async (e) => {
        clearTimeout(pollTimeout);
        const selectedOption = e.currentTarget;
        const answerId = selectedOption.dataset.id;
        const timeTaken = (Date.now() - questionStartTime) / 1000;

        document.querySelectorAll('.answer-option').forEach(btn => btn.disabled = true);

        try {
            const response = await fetch('/api/juego/responder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_participante: gameState.id_participante,
                    id_pregunta: gameState.pregunta_actual.id_pregunta,
                    id_respuesta_seleccionada: answerId,
                    tiempo_respuesta_segundos: timeTaken.toFixed(2)
                })
            });

            const data = await response.json();
            console.log("Respuesta del servidor:", data);

            if (data.success) {
                hasAnswered = true;
                pendingResultado = {
                    es_correcta: data.es_correcta,
                    puntuacion_obtenida: data.puntos_obtenidos
                };

            }

        } catch (err) {
            console.error("Error al guardar respuesta:", err);
        } finally {
            pollTimeout = setTimeout(longPoll, 2000);
        }
    };

    // --- POLLING ---
    const longPoll = async (interval = 3000) => {
        try {
            // Añadimos un timestamp al final (?_=...) para evitar caché del navegador
            const response = await fetch(`/api/juego/estado_alumno?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            gameState = data;

            // Condiciones de fin de juego
            const isGameFinished = data.estado_juego === 'finalizada' ||
                (data.estado_juego === 'en_curso' && data.fase === 'finalizada') ||
                (!data.pregunta_actual && !['pregunta', 'resultado', 'iniciando'].includes(data.fase));

            if (isGameFinished) {
                console.log("Juego finalizado.");
                clearInterval(timerInterval);
                clearTimeout(pollTimeout);

                // Cargar estilos y mostrar pantallas finales
                injectPodiumStyles();
                renderPodium(data.marcador || []);
                renderRewards(data.recompensas || []);

                // Si tienes la función renderFinalRanking (del código anterior), úsala:
                if (typeof renderFinalRanking === 'function') {
                    renderFinalRanking(
                        data.marcador || [],
                        data.id_participante,
                        data.puesto,
                        data.puntuacion_final,
                        data.puntuacion_individual
                    );
                }

                showScreen('end');

            } else if (data.estado_juego === 'en_curso') {

                if (data.fase === 'pregunta' && data.pregunta_actual) {
                    renderQuestion(data.pregunta_actual, data.segundos_transcurridos);

                } else if (data.fase === 'resultado') {
                    // Mostrar feedback (Correcto/Incorrecto)
                    if (pendingResultado) {
                        showFeedback(pendingResultado);
                        pendingResultado = null;
                    } else if (data.resultado_respuesta) {
                        showFeedback({
                            es_correcta: !!data.resultado_respuesta.es_correcta,
                            puntuacion_obtenida: data.resultado_respuesta.puntuacion_obtenida || 0
                        });
                    }
                } else {

                    if(!hasAnswered && !feedbackShownForQuestion) showScreen('loading');
                }

                // Programar la siguiente llamada
                pollTimeout = setTimeout(() => longPoll(interval), interval);

            } else {
                console.warn("Estado desconocido:", data.estado_juego);
                clearTimeout(pollTimeout);
            }

        } catch (e) {
            console.error("Error polling:", e);
            // Reintentar con un tiempo de espera progresivo (backoff)
            const next = Math.min(interval * 2, 8000);
            pollTimeout = setTimeout(() => longPoll(next), next);
        }
    };


    showScreen('loading');
    longPoll();
});
