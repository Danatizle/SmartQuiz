document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. INYECCIÓN DE ESTILOS CSS
    // ==========================================
    const injectPodiumStyles = () => {
        const cssStyles = `
            .final-view:not(.hidden) { display: flex; flex-direction: column; justify-content: center; align-items: center; padding-top: 80px; box-sizing: border-box; }
            .final-title { font-size: 3rem; color: #f0c419; margin-bottom: 20px; }
            .podium-container { display: flex; justify-content: center; align-items: flex-end; gap: 15px; width: 90%; max-width: 600px; margin: 20px auto; min-height: 200px; }
            .podium-item { background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 20px; width: 30%; text-align: center; color: white; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3); order: 2; }
            .podium-item .position { font-size: 2.5rem; font-weight: 900; margin-bottom: 10px; }
            .podium-item .name { font-size: 1.2rem; font-weight: 700; word-break: break-all; }
            .podium-item .score { font-size: 1rem; color: #f0c419; margin-top: 5px; }
            .podium-item.first-place { height: 180px; background: #f0c419; color: #333; border-color: #f5d45c; order: 1; }
            .podium-item.first-place .score { color: #333; font-weight: 700; }
            .podium-item.second-place { height: 140px; background: #c0c0c0; color: #333; border-color: #ddd; order: 0; }
            .podium-item.second-place .score { color: #333; }
            .podium-item.third-place { height: 100px; background: #cd7f32; color: #fff; border-color: #d89b6a; order: 2; }
            .podium-item.third-place .score { color: #fff; }
            .rewards-container { margin-top: 30px; width: 90%; max-width: 600px; text-align: center; }
            .rewards-container h3 { font-size: 1.5rem; color: #f0c419; margin-bottom: 10px; }
            .rewards-list { list-style: none; padding: 0; margin: 0; }
            .rewards-list li { font-size: 1.1rem; color: #fff; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; }
            .rewards-list li:last-child { border-bottom: none; }
            .rewards-list li strong { color: #f0c419; margin-right: 10px; flex-shrink: 0; }
            .rewards-list li span { color: #eee; }
            #leaderboardList { max-height: 50vh; overflow-y: auto; padding-right: 10px; margin-bottom: 20px; }
            #leaderboardList::-webkit-scrollbar { width: 8px; }
            #leaderboardList::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.1); }
            #leaderboardList::-webkit-scrollbar-thumb { background: #f0c419; border-radius: 4px; }

            /* Utilidad para ocultar controles */
            .hidden { display: none !important; }
        `;
        const styleElement = document.createElement('style');
        styleElement.innerHTML = cssStyles;
        document.head.appendChild(styleElement);
    };
    injectPodiumStyles();

    // ==========================================
    // 2. REFERENCIAS AL DOM
    // ==========================================
    const quizTitleEl = document.getElementById('quizTitle');
    const views = {
        question: document.getElementById('questionView'),
        results: document.getElementById('resultsView'),
        leaderboard: document.getElementById('leaderboardView'),
        final: document.getElementById('finalView'),
    };

    // Elementos de info de juego
    const profQuestionCounterEl = document.getElementById('profQuestionCounter');
    const profTimerEl = document.getElementById('profTimer');
    const profQuestionTextEl = document.getElementById('profQuestionText');
    const answersCountEl = document.getElementById('answersCount');
    const resultQuestionTextEl = document.getElementById('resultQuestionText');

    // Botones LIVE
    const nextQuestionBtn = document.getElementById('nextQuestionBtn');
    const goToNextQuestionBtn = document.getElementById('goToNextQuestionBtn');

    // Botones MARCADOR
    const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
    const leaderboardNextBtn = document.getElementById('leaderboardNextBtn');
    const backToResultsBtn = document.getElementById('backToResultsBtn');
    const backToPodiumBtn = document.getElementById('backToPodiumBtn');
    const leaderboardListEl = document.getElementById('leaderboardList');

    // Botones PODIO
    const verPuntuacionesBtn = document.getElementById('verPuntuacionesBtn');
    const exportarDatosBtn = document.getElementById('exportarDatosBtn');
    const exportarAOneDriveBtn = document.getElementById('exportarAOneDriveBtn');

    // Botones MODO REVISIÓN
    const liveGameControls = document.getElementById('liveGameControls');
    const reviewControls = document.getElementById('reviewControls');
    const btnPrevReview = document.getElementById('btnPrevReview');
    const btnNextReview = document.getElementById('btnNextReview');
    const btnExitReview = document.getElementById('btnExitReview');
    const reviewCounter = document.getElementById('reviewCounter');

    // Chart
    const canvasEl = document.getElementById('resultsChart');
    let ctx = canvasEl ? canvasEl.getContext('2d') : null;
    let resultsChart;

    // Estado
    let pollInterval;
    let timerValue = 0;
    let timerInterval;
    let timerRunning = false;
    let lastRenderedQuestionId = null;
    let currentReviewIndex = 0;
    let totalQuestionsInReview = 0;

    // ==========================================
    // 3. FUNCIONES AUXILIARES
    // ==========================================

    const showView = (viewName) => {
        Object.keys(views).forEach(key => {
            if (views[key]) {
                if (key === viewName) views[key].classList.remove('hidden');
                else views[key].classList.add('hidden');
            }
        });
    };

    const startProfTimer = (duration) => {
        clearInterval(timerInterval);
        timerValue = parseInt(duration, 10) || 0;
        if (timerValue <= 0) { profTimerEl.textContent = '0'; timerRunning = false; return; }

        timerRunning = true;
        profTimerEl.textContent = timerValue;

        timerInterval = setInterval(async () => {
            timerValue--;
            profTimerEl.textContent = timerValue;
            if (timerValue <= 0) {
                clearInterval(timerInterval);
                timerRunning = false;
                try { await fetch(`/api/juego/forzar_resultado/${PIN}`, { method: 'POST' }); } catch (err) {}
            }
        }, 1000);
    };

    // --- Renderizadores Gráficos ---

    const renderPodium = (marcador) => {
        const container = document.getElementById('podium');
        if (!container) return;
        container.innerHTML = '';
        const top3 = marcador.slice(0, 3);

        // Helper para HTML del podio
        const createItem = (pos, cls, data) => `
            <div class="podium-item ${cls}">
                <div class="position">${pos}</div>
                <div class="name">${data ? data.nombre_usuario_partida : '---'}</div>
                <div class="score">${data ? data.puntuacion_total + ' pts' : '--- pts'}</div>
            </div>`;

        let html = '';
        html += createItem('2º', 'second-place', top3[1]);
        html += createItem('1º', 'first-place', top3[0]);
        html += createItem('3º', 'third-place', top3[2]);
        container.innerHTML = html;
    };

    const renderRewards = (recompensas) => {
        const list = document.getElementById('rewardsList');
        if (!list) return;
        list.innerHTML = '';
        const container = list.closest('.rewards-container');
        if (!recompensas || recompensas.length === 0) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');

        const medals = ['🥇', '🥈', '🥉'];
        recompensas.slice(0, 3).forEach((desc, i) => {
            const li = document.createElement('li');
            li.innerHTML = `${medals[i] || ''} <strong>Puesto ${i+1}:</strong> <span>${desc}</span>`;
            list.appendChild(li);
        });
    };

    const renderLeaderboard = (marcador) => {
        if (!leaderboardListEl) return;
        leaderboardListEl.innerHTML = '';
        if (!marcador || marcador.length === 0) {
            leaderboardListEl.innerHTML = '<p class="empty-leaderboard">Aún no hay puntuaciones.</p>';
            return;
        }
        marcador.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-item';
            div.innerHTML = `<span class="rank">${i+1}.</span><span class="name">${p.nombre_usuario_partida}</span><span class="score">${p.puntuacion_total} pts</span>`;
            leaderboardListEl.appendChild(div);
        });
    };

    const renderResults = (data) => {
        if (!ctx) return;
        const stats = data.respuestas_info?.estadisticas ?? {};
        // Nota: Si viene del historial, la estructura de 'pregunta_actual' puede variar ligeramente
        const answers = data.pregunta_actual?.respuestas ?? [];

        const labels = [];
        const values = [];
        const bgColors = [];

        answers.forEach((ans, i) => {
            labels.push(ans.texto_respuesta);
            values.push(stats[ans.texto_respuesta] ?? 0);
            // Verde si es correcta, Rojo/Gris si no
            if (ans.es_correcta) bgColors.push('rgba(46, 204, 113, 0.8)');
            else bgColors.push('rgba(231, 76, 60, 0.8)');
        });

        if (resultsChart) resultsChart.destroy();

        resultsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Respuestas',
                    data: values,
                    backgroundColor: bgColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                plugins: { legend: { display: false } }
            }
        });
    };

    // ==========================================
    // 4. LÓGICA DE ACTUALIZACIÓN UI (LIVE)
    // ==========================================
    const updateUI = (data) => {
        // Verificar fin de juego
        const isGameFinished = data.estado_juego === 'finalizada' ||
                               (data.estado_juego === 'en_curso' && data.fase === 'finalizada');

        if (isGameFinished) {
            console.log("Juego finalizado.");
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            timerRunning = false;
            renderPodium(data.marcador || []);
            renderRewards(data.recompensas || []);
            showView('final');
            return; // Detenemos actualización live
        }

        if (!quizTitleEl) return;
        quizTitleEl.textContent = data.quiz_titulo || 'Quiz';

        if (data.pregunta_actual) {
            const pId = data.pregunta_actual.id_pregunta;

            // 🔥 CORRECCIÓN AQUI: Definimos una variable segura
            // Si 'texto' viene vacío o undefined, usa "Pregunta..."
            const textoPregunta = data.pregunta_actual.texto || "Pregunta...";

            // Detectar cambio de pregunta
            if (pId !== lastRenderedQuestionId || views.question.classList.contains('hidden')) {
                if (data.fase === 'pregunta') {
                    lastRenderedQuestionId = pId;
                    profQuestionCounterEl.textContent = `Pregunta ${data.pregunta_actual.numero} de ${data.pregunta_actual.total_preguntas}`;

                    // ✅ Usamos la variable segura
                    profQuestionTextEl.textContent = textoPregunta;

                    // Actualizamos también el título de resultados por si acaso
                    resultQuestionTextEl.textContent = `Resultados: ${textoPregunta}`;

                    startProfTimer(data.pregunta_actual.tiempo_limite);
                    showView('question');
                }
            }

            answersCountEl.textContent = data.respuestas_info?.recibidas ?? 0;

            // Fase Resultado
            if (data.fase === 'resultado') {
                if (timerRunning) { clearInterval(timerInterval); timerRunning = false; }

                // ✅ Usamos la variable segura aquí también
                resultQuestionTextEl.textContent = `Resultados: ${textoPregunta}`;

                renderResults(data);

                // Si no estamos viendo el marcador, forzar vista de resultado
                if (views.leaderboard.classList.contains('hidden')) {
                    showView('results');
                    // Asegurar que se ven controles LIVE y no REVISIÓN
                    liveGameControls.classList.remove('hidden');
                    reviewControls.classList.add('hidden');
                }
            }
        }
        renderLeaderboard(data.marcador || []);
    };

    const fetchGameState = async () => {
        if (!PIN) return;
        try {
            const res = await fetch(`/api/juego/estado_profesor/${PIN}`);
            if (res.ok) {
                const data = await res.json();
                updateUI(data);
            }
        } catch (e) { console.error(e); }
    };

    const advanceToNext = async () => {
        // Bloquear botones
        [nextQuestionBtn, goToNextQuestionBtn, leaderboardNextBtn].forEach(b => b.disabled = true);
        try {
            const res = await fetch(`/api/juego/siguiente_pregunta/${PIN}`, { method: 'POST' });
            if (res.ok) await fetchGameState();
        } catch (e) { console.error(e); }
        finally {
            setTimeout(() => {
                [nextQuestionBtn, goToNextQuestionBtn, leaderboardNextBtn].forEach(b => b.disabled = false);
            }, 1000);
        }
    };

    // ==========================================
    // 5. LÓGICA DE MODO REVISIÓN (HISTORIAL)
    // ==========================================
   // ==========================================
    // 5. LÓGICA DE MODO REVISIÓN (HISTORIAL)
    // ==========================================
    const loadReviewQuestion = async (index) => {
        try {
            console.log("Cargando historial índice:", index);
            const res = await fetch(`/api/juego/historial/${PIN}/${index}`);
            const data = await res.json();

            if (data.success) {
                // 🔥 CORRECCIÓN AQUÍ:
                // Usamos "||" para buscar 'texto' O 'texto_pregunta' O un valor por defecto.
                const textoPregunta = data.pregunta.texto || data.pregunta.texto_pregunta || "Pregunta...";

                resultQuestionTextEl.textContent = `Revisión: ${textoPregunta}`;
                reviewCounter.textContent = `${index + 1} / ${data.total_preguntas}`;

                // Adaptar datos para usar la misma función de renderizado
                const fakeData = {
                    respuestas_info: { estadisticas: data.estadisticas },
                    pregunta_actual: { respuestas: data.pregunta.respuestas }
                };
                renderResults(fakeData);

                // Mostrar vista de resultados con controles de revisión
                showView('results');
                liveGameControls.classList.add('hidden');
                reviewControls.classList.remove('hidden');
                reviewControls.style.display = 'flex'; // Asegurar display flex

                // Estado de botones
                if (btnPrevReview) btnPrevReview.disabled = (index === 0);
                if (btnNextReview) btnNextReview.textContent = (index === data.total_preguntas - 1) ? "Finalizar" : "Siguiente ➡";

                currentReviewIndex = index;
                totalQuestionsInReview = data.total_preguntas;
            }
        } catch (e) { console.error("Error historial:", e); }
    };

    // Listeners Modo Revisión
    btnPrevReview?.addEventListener('click', () => {
        if (currentReviewIndex > 0) loadReviewQuestion(currentReviewIndex - 1);
    });

    btnNextReview?.addEventListener('click', () => {
        if (currentReviewIndex < totalQuestionsInReview - 1) {
            loadReviewQuestion(currentReviewIndex + 1);
        } else {
            // Si es el último y da siguiente, volver al podio
            showView('final');
        }
    });

    btnExitReview?.addEventListener('click', () => {
        showView('final');
    });


    // ==========================================
    // 6. EVENT LISTENERS PRINCIPALES
    // ==========================================

    // Botones Avance Live
    nextQuestionBtn?.addEventListener('click', advanceToNext);
    goToNextQuestionBtn?.addEventListener('click', advanceToNext);

    // Botones Navegación Marcador

    // A) Ver Gráfico (Durante Live)
    backToResultsBtn?.addEventListener('click', () => {
        liveGameControls.classList.remove('hidden');
        reviewControls.classList.add('hidden');
        showView('results');
    });

    // B) Regresar al Podio (Fin Juego)
    backToPodiumBtn?.addEventListener('click', () => showView('final'));

    // C) Botón Mágico "Siguiente" en Marcador
    // Este botón actúa diferente si el juego está vivo o muerto
    leaderboardNextBtn?.addEventListener('click', () => {
        // Chequear si estamos en fase final (podio visible o botón 'backToPodium' visible)
        const isFinished = !backToPodiumBtn.classList.contains('hidden');

        if (isFinished) {
            // MODO REVISIÓN: Iniciar recorrido desde la pregunta 0
            loadReviewQuestion(0);
        } else {
            // MODO LIVE: Avanzar partida
            advanceToNext();
        }
    });

    // Botones de Entrada al Marcador

    // Desde Live (Mitad del juego)
    showLeaderboardBtn?.addEventListener('click', () => {
        backToResultsBtn.classList.remove('hidden');
        leaderboardNextBtn.classList.remove('hidden');
        leaderboardNextBtn.textContent = "Siguiente Pregunta";
        backToPodiumBtn.classList.add('hidden');
        showView('leaderboard');
    });

    // Desde Final (Podio)
    verPuntuacionesBtn?.addEventListener('click', () => {
        backToResultsBtn.classList.add('hidden'); // No queremos volver al gráfico "actual" (no existe)

        leaderboardNextBtn.classList.remove('hidden');
        leaderboardNextBtn.textContent = "Ver Recorrido de Gráficos"; // Cambiamos texto

        backToPodiumBtn.classList.remove('hidden');
        showView('leaderboard');
    });

    // Exportar
    exportarDatosBtn?.addEventListener('click', async () => {
        /* Lógica de exportación (abreviada para no repetir tanto código, es la misma de antes) */
        try {
            const res = await fetch(`/api/juego/exportar/${PIN}`);
            if(res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `resultados_${PIN}.xlsx`;
                document.body.appendChild(a); a.click(); a.remove();
            }
        } catch(e) { alert("Error exportando"); }
    });

    exportarAOneDriveBtn?.addEventListener('click', async () => {
        try {
            const res = await fetch(`/api/juego/enviar_email/${PIN}`, { method: 'POST' });
            const d = await res.json();
            alert(d.message);
        } catch(e) { alert("Error enviando email"); }
    });

    // ==========================================
    // 7. INICIALIZACIÓN
    // ==========================================
    if (typeof PIN !== 'undefined' && PIN) {
        console.log("Iniciando juego:", PIN);
        fetchGameState();
        pollInterval = setInterval(fetchGameState, 3000);
    } else {
        document.body.innerHTML = '<h1>Error: Sin PIN</h1>';
    }
});