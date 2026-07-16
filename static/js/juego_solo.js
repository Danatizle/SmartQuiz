document.addEventListener("DOMContentLoaded", () => {
    // Elementos de la UI
    const screens = {
        loading: document.getElementById("loadingScreen"),
        question: document.getElementById("questionScreen"),
        feedback: document.getElementById("feedbackScreen"),
        end: document.getElementById("endScreen")
    };
    
    const questionCounterEl = document.getElementById("questionCounter");
    const timerEl = document.getElementById("timer");
    const questionTextEl = document.getElementById("questionText");
    const questionImageEl = document.getElementById("questionImage");
    const answerOptionsEl = document.getElementById("answerOptions");
    const feedbackTextEl = document.getElementById("feedbackText");
    const pointsEarnedEl = document.getElementById("pointsEarned");
    
    // Variables del juego
    let indicePregunta = 0;
    let puntajeTotal = 0;
    let correctas = 0;
    let timerInterval;
    let timeRemaining;
    let hasAnswered = false;
    
    // Función para mostrar pantallas
    const showScreen = (screenName) => {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[screenName]) screens[screenName].classList.add('active');
    };
    
    // Temporizador
    const startTimer = (duration) => {
        clearInterval(timerInterval);
        timeRemaining = duration;
        timerEl.textContent = timeRemaining;
        
        timerInterval = setInterval(() => {
            timeRemaining--;
            timerEl.textContent = timeRemaining;
            
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                if (!hasAnswered) {
                    mostrarFeedback(false, 0);
                }
            }
        }, 1000);
    };
    
    // Mostrar pregunta
    const mostrarPregunta = (index) => {
        if (index >= QUIZ_DATA.preguntas.length) {
            finalizarJuego();
            return;
        }
        
        const pregunta = QUIZ_DATA.preguntas[index];
        hasAnswered = false;
        
        questionTextEl.textContent = pregunta.texto_pregunta;
        questionCounterEl.textContent = `${index + 1} / ${QUIZ_DATA.preguntas.length}`;
        
        // Imagen
        if (pregunta.url_media) {
            questionImageEl.src = pregunta.url_media;
            questionImageEl.classList.remove('hidden');
        } else {
            questionImageEl.classList.add('hidden');
        }
        
        // Respuestas
        answerOptionsEl.innerHTML = '';
        const shapes = ['triangle', 'diamond', 'circle', 'square'];
        pregunta.respuestas.forEach((resp, idx) => {
            const btn = document.createElement('button');
            btn.className = `answer-option shape-${shapes[idx % 4]}`;
            btn.innerHTML = `<span>${resp.texto_respuesta}</span>`;
            btn.onclick = () => manejarRespuesta(resp, pregunta);
            answerOptionsEl.appendChild(btn);
        });
        
        startTimer(pregunta.tiempo_limite_segundos || 30);
        showScreen('question');
    };
    
    // Manejar respuesta
    const manejarRespuesta = (respuesta, pregunta) => {
        if (hasAnswered) return;
        hasAnswered = true;
        clearInterval(timerInterval);
        
        document.querySelectorAll('.answer-option').forEach(btn => btn.disabled = true);
        
        let puntos = 0;
        if (respuesta.es_correcta) {
            correctas++;
            // Fórmula de puntos basada en tiempo
            const tiempoTotal = pregunta.tiempo_limite_segundos || 30;
            puntos = Math.max(500, Math.round(1000 * (timeRemaining / tiempoTotal)));
            puntajeTotal += puntos;
        }
        
        mostrarFeedback(respuesta.es_correcta, puntos);
    };
    
    // Mostrar feedback
    const mostrarFeedback = (esCorrecta, puntos) => {
        if (esCorrecta) {
            feedbackTextEl.textContent = "¡Correcto!";
            screens.feedback.classList.add('correct');
            screens.feedback.classList.remove('incorrect');
        } else {
            feedbackTextEl.textContent = "Incorrecto";
            screens.feedback.classList.add('incorrect');
            screens.feedback.classList.remove('correct');
        }
        
        pointsEarnedEl.textContent = puntos;
        showScreen('feedback');
        
        setTimeout(() => {
            indicePregunta++;
            mostrarPregunta(indicePregunta);
        }, 2000);
    };
    
    // Finalizar juego
    // Finalizar juego
    const finalizarJuego = () => {
        const total = QUIZ_DATA.preguntas.length;
        const precision = ((correctas / total) * 100).toFixed(1);
        
        document.getElementById('myRankPosition').textContent = 'Preguntas correctas';
        document.getElementById('myRankScore').textContent = `${correctas} / ${total}`;
        document.getElementById('myFinalScore').textContent = `${puntajeTotal} pts`;
        document.getElementById('myPrecision').textContent = `${precision}%`;
        
        // 🎯 Animar la barra de progreso
        setTimeout(() => {
            const progressBar = document.getElementById('accuracyBar');
            if (progressBar) {
                progressBar.style.width = `${precision}%`;
            }
        }, 100);
        
        showScreen('end');
    };
    
    // Iniciar juego
    if (!QUIZ_DATA || !QUIZ_DATA.preguntas || QUIZ_DATA.preguntas.length === 0) {
        document.querySelector('#loadingScreen h1').textContent = 'Error: No hay preguntas';
        return;
    }
    
    setTimeout(() => {
        mostrarPregunta(0);
    }, 500);
});