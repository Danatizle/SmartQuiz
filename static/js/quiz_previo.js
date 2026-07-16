// quiz_previo.js - Previsualización de Cuestionarios en Español
document.addEventListener("DOMContentLoaded", () => {
    // --- ELEMENTOS DEL DOM ---
    const pantallaPreguntas = document.getElementById("questionScreen");
    const contadorPreguntasEl = document.getElementById("questionCounter");
    const textoPregunataEl = document.getElementById("questionText");
    const imagenPreguntaEl = document.getElementById("questionImage");
    const opcionesEl = document.getElementById("answerOptions");
    const contenedorNavegacion = document.querySelector(".preview-navigation") ||
                                document.createElement("div");

    // --- VARIABLES DE ESTADO ---
    let datosQuiz = null;
    let indiceActual = 0;

    // --- INICIALIZACIÓN ---
    const inicializar = () => {
        // Obtener datos del quiz pasados por Flask
        if (typeof window.quiz_data !== 'undefined' && window.quiz_data) {
            datosQuiz = window.quiz_data;
            console.log("✅ Datos del quiz cargados:", datosQuiz);
            renderizarPregunta(indiceActual);
            mostrarPantallaPregunta();
        } else {
            console.error("❌ No se encontraron datos del quiz");
            mostrarMensajeError("No se pudieron cargar los datos del quiz.");
        }
    };

    // --- RENDERIZAR PREGUNTA ---
    const renderizarPregunta = (indice) => {
        if (!datosQuiz || !datosQuiz.preguntas || indice >= datosQuiz.preguntas.length) {
            mostrarMensajeError("No hay más preguntas disponibles.");
            return;
        }

        const pregunta = datosQuiz.preguntas[indice];
        indiceActual = indice;

        console.log(`📝 Cargando pregunta ${indice + 1}:`, pregunta);

        // Actualizar contador
        contadorPreguntasEl.textContent = `${indice + 1} / ${datosQuiz.preguntas.length}`;

        // Actualizar texto de pregunta
        const textoQuestion = pregunta.texto_pregunta || pregunta.texto || "Pregunta sin texto";
        textoPregunataEl.textContent = textoQuestion;

        // Mostrar imagen si existe
        if (pregunta.media && pregunta.media !== "") {
            imagenPreguntaEl.src = pregunta.media;
            imagenPreguntaEl.classList.remove('hidden');
        } else {
            imagenPreguntaEl.classList.add('hidden');
        }

        // Limpiar opciones previas
        opcionesEl.innerHTML = '';
        const formas = ['triangle', 'diamond', 'circle', 'square'];

        // Renderizar opciones de respuesta
        if (pregunta.respuestas && pregunta.respuestas.length > 0) {
            pregunta.respuestas.forEach((respuesta, indiceRespuesta) => {
                const botonOpcion = document.createElement('button');
                botonOpcion.className = `answer-option shape-${formas[indiceRespuesta % 4]} opcion-previo`;

                // Marcar respuesta correcta en preview
                if (respuesta.es_correcta) {
                    botonOpcion.classList.add('respuesta-correcta-preview');
                    botonOpcion.setAttribute('title', '✓ Esta es la respuesta correcta');
                }

                const textoRespuesta = respuesta.texto_respuesta || respuesta.texto || "Opción vacía";
                botonOpcion.innerHTML = `<span>${textoRespuesta}</span>`;

                // Permitir seleccionar para ver (sin efectos en juego real)
                botonOpcion.addEventListener('click', () => {
                    document.querySelectorAll('.opcion-previo').forEach(opt => {
                        opt.classList.remove('opcion-seleccionada');
                    });
                    botonOpcion.classList.add('opcion-seleccionada');
                });

                opcionesEl.appendChild(botonOpcion);
            });
        }

        actualizarBotonesNavegacion();
    };

    // --- ACTUALIZAR BOTONES DE NAVEGACIÓN ---
    const actualizarBotonesNavegacion = () => {
        // Limpiar navegación anterior
        contenedorNavegacion.innerHTML = '';
        contenedorNavegacion.className = 'preview-navigation';
        contenedorNavegacion.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin-top: 30px;
            padding: 20px;
            background: rgba(0,0,0,0.05);
            border-radius: 8px;
            flex-wrap: wrap;
        `;

        // BOTÓN ANTERIOR
        if (indiceActual > 0) {
            const btnAnterior = document.createElement('button');
            btnAnterior.textContent = '⬅️ Anterior';
            btnAnterior.className = 'btn-navegacion btn-anterior';
            btnAnterior.style.cssText = `
                padding: 10px 20px;
                background: #6c63ff;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
            `;
            btnAnterior.addEventListener('mouseenter', e => e.target.style.background = '#5a52d5');
            btnAnterior.addEventListener('mouseleave', e => e.target.style.background = '#6c63ff');
            btnAnterior.addEventListener('click', () => {
                indiceActual--;
                renderizarPregunta(indiceActual);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            contenedorNavegacion.appendChild(btnAnterior);
        }

        // INDICADOR DE PÁGINA
        const indicadorPagina = document.createElement('span');
        indicadorPagina.textContent = `${indiceActual + 1} / ${datosQuiz.preguntas.length}`;
        indicadorPagina.style.cssText = `
            align-self: center;
            font-weight: 700;
            color: #333;
            padding: 0 15px;
            min-width: 60px;
            text-align: center;
            font-size: 15px;
        `;
        contenedorNavegacion.appendChild(indicadorPagina);

        // BOTÓN SIGUIENTE
        if (indiceActual < datosQuiz.preguntas.length - 1) {
            const btnSiguiente = document.createElement('button');
            btnSiguiente.textContent = 'Siguiente ➡️';
            btnSiguiente.className = 'btn-navegacion btn-siguiente';
            btnSiguiente.style.cssText = `
                padding: 10px 20px;
                background: #6c63ff;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
            `;
            btnSiguiente.addEventListener('mouseenter', e => e.target.style.background = '#5a52d5');
            btnSiguiente.addEventListener('mouseleave', e => e.target.style.background = '#6c63ff');
            btnSiguiente.addEventListener('click', () => {
                indiceActual++;
                renderizarPregunta(indiceActual);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            contenedorNavegacion.appendChild(btnSiguiente);
        }

        // BOTÓN CERRAR
        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = '❌ Cerrar';
        btnCerrar.className = 'btn-navegacion btn-cerrar';
        btnCerrar.style.cssText = `
            padding: 10px 20px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s ease;
        `;
        btnCerrar.addEventListener('mouseenter', e => e.target.style.background = '#c0392b');
        btnCerrar.addEventListener('mouseleave', e => e.target.style.background = '#e74c3c');
        btnCerrar.addEventListener('click', () => {
            history.back();
        });
        contenedorNavegacion.appendChild(btnCerrar);

        // Insertar contenedor de navegación después de las opciones
        if (opcionesEl.nextSibling) {
            opcionesEl.parentNode.insertBefore(contenedorNavegacion, opcionesEl.nextSibling);
        } else {
            opcionesEl.parentNode.appendChild(contenedorNavegacion);
        }
    };

    // --- MOSTRAR/OCULTAR PANTALLAS ---
    const mostrarPantallaPregunta = () => {
        const todasLasPantallas = document.querySelectorAll('.game-screen');
        todasLasPantallas.forEach(pantalla => pantalla.classList.remove('active'));
        if (pantallaPreguntas) {
            pantallaPreguntas.classList.add('active');
        }
    };

    const mostrarMensajeError = (mensaje) => {
        if (pantallaPreguntas) {
            pantallaPreguntas.innerHTML = `
                <div style="
                    padding: 40px;
                    text-align: center;
                    background: #ffe0e0;
                    border-radius: 8px;
                    margin: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                ">
                    <h2 style="color: #c0392b; margin-bottom: 15px; font-size: 24px;">⚠️ Error</h2>
                    <p style="color: #555; font-size: 16px; margin-bottom: 20px; line-height: 1.6;">${mensaje}</p>
                    <button onclick="history.back()" style="
                        padding: 12px 24px;
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        transition: all 0.3s;
                    " onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
                        Volver
                    </button>
                </div>
            `;
            mostrarPantallaPregunta();
        }
    };

    // --- INICIAR LA APLICACIÓN ---
    inicializar();
});