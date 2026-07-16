// crear_cuestionario.js
document.addEventListener('DOMContentLoaded', function() {

    // --- FUNCIONES DE MAPEO PARA TRADUCIR FRONTEND <-> BACKEND ---

    /**
     * Convierte el valor numérico/corto del frontend (p.puntos) al VARCHAR de la BD.
     */
   function mapearPuntosParaBD(puntosFrontend) {
    switch (puntosFrontend) {
        case 1:
            return 'Estándar';
        case 2:
            return 'Puntos dobles';
        case 0:
            return 'Ningun punto'; // <--- ESTA ES LA CORRECCIÓN CLAVE
        default:
            return 'Estándar'; // Valor por defecto si falla
    }
}

    /**
     * Convierte el valor corto del frontend (p.opcion_respuesta) al VARCHAR de la BD.
     */
    function mapearOpcionRptaParaBD(opcionFrontend) {
        switch (opcionFrontend) {
            case 'simple':
                return 'Selección simple';
            case 'multiple':
                return 'Selección múltiple';
            default:
                return 'Selección simple'; // Valor por defecto si falla
        }
    }

    /**
     * Convierte el valor VARCHAR de la BD a un valor numérico/corto para el frontend.
     */
    function mapearPuntosParaFrontend(puntosBD) {
        switch (puntosBD) {
            case 'Estándar':
                return 1;
            case 'Puntos dobles':
                return 2;
            case 'Sin puntos':
                return 0;
            default:
                return 1;
        }
    }

    /**
     * Convierte el valor VARCHAR de la BD a un valor corto para el frontend.
     */
    function mapearOpcionRptaParaFrontend(opcionBD) {
        switch (opcionBD) {
            case 'Selección simple':
                return 'simple';
            case 'Selección múltiple':
                return 'multiple';
            default:
                return 'simple';
        }
    }

    // -----------------------------------------------------------------------

    // --- VARIABLES GLOBALES ---
    let cuestionario = {
        titulo: "Cuestionario sin título",
        descripcion: "",
        visibilidad: "privado",
       imagen_portada: null,
        preguntas: [],
        recompensas: [
            { descripcion: "+1 punto en el examen" },
            { descripcion: "Exoneración de tarea-actividad" },
            { descripcion: "Reconocimiento en clase" }
        ]
    };
    let idCuestionarioEditando = null;
    let preguntaActualIndex = 0;
    let indexToDelete = null; // ▼▼▼ VARIABLE NUEVA: para guardar el índice de la pregunta a borrar
    let idCuestionarioGuardado = null; // ✅ ID del cuestionario recién guardado

    // --- REFERENCIAS AL DOM ---
    const questionListContainer = document.getElementById('question-list-container');
    const questionContentArea = document.getElementById('question-content-area');
    const addQuestionBtnContainer = document.getElementById('add-question-btn-container');
    const btnGuardarCuestionario = document.getElementById('btnGuardarCuestionario');
    const successModal = document.getElementById('successModal');
    // ▼▼▼ REFERENCIAS NUEVAS para Validación
    const validationModal = document.getElementById('validationModal');
    const errorListContainer = document.getElementById('validation-error-list');
    const btnVolverAEditarDesdeError = document.getElementById('btnVolverAEditarDesdeError');
    const btnMantenerCambiosDesdeError = document.getElementById('btnMantenerCambiosDesdeError');
    // ▼▼▼ REFERENCIAS NUEVAS: para el modal de confirmación de borrado
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    const simpleAlertModal = document.getElementById('simpleAlertModal');
    const simpleAlertTitle = document.getElementById('simpleAlertTitle');
    const simpleAlertMessage = document.getElementById('simpleAlertMessage');
    const simpleAlertOkBtn = document.getElementById('simpleAlertOkBtn');

    const genericConfirmModal = document.getElementById('genericConfirmModal');
    const genericConfirmTitle = document.getElementById('genericConfirmTitle');
    const genericConfirmMessage = document.getElementById('genericConfirmMessage');
   let genericConfirmOkBtn = document.getElementById('genericConfirmOkBtn'); // <-- Cambiado a let
let genericConfirmCancelBtn = document.getElementById('genericConfirmCancelBtn'); // <-- Cambiado a let


    // --- INICIALIZACIÓN ---
    function inicializar() {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.includes('editar') && pathParts.length > 2) {
            idCuestionarioEditando = pathParts[pathParts.indexOf('editar') - 1];
            cargarDatosDelCuestionario(idCuestionarioEditando);
        } else {
            agregarNuevaPregunta();
        }
        configurarEventListenersGenerales();
        configurarModalAjustes();
        configurarManejoPortada();
        configurarModalesComplejos();
        configurarSelectoresPersonalizados();
    }

    // --- LÓGICA DE RENDERIZADO (Sin cambios) ---
    function renderizarTodo() {
        renderizarListaDePreguntas();
        renderizarPreguntaActiva();
    }

    function renderizarListaDePreguntas() {
        questionListContainer.innerHTML = '';
        cuestionario.preguntas.forEach((pregunta, index) => {
            const item = document.createElement('div');
            item.className = 'question-item';
            if (index === preguntaActualIndex) item.classList.add('active');
            item.innerHTML = `<div class="question-number">${index + 1}</div><div class="question-type">${pregunta.tipo_pregunta === 'opcion_multiple' ? 'Quiz' : 'V/F'}</div>`;
            item.addEventListener('click', () => {
                preguntaActualIndex = index;
                renderizarTodo();
            });
            questionListContainer.appendChild(item);
        });
    }

    function showCustomAlert(message, title = 'Aviso', type = 'info') {
    if (!simpleAlertModal || !simpleAlertTitle || !simpleAlertMessage || !simpleAlertOkBtn) {
        // Fallback si algo falla al cargar el modal
        console.error("Faltan elementos del modal de alerta simple. Usando alert() nativo.");
        alert(message);
        return;
    }

    simpleAlertTitle.textContent = title;
    simpleAlertMessage.textContent = message;

    // Cambiar color del título si es un error
    if (type === 'error') {
        simpleAlertTitle.style.color = 'var(--danger-color)';
    } else {
        simpleAlertTitle.style.color = 'var(--text-color)'; // Color normal
    }

    simpleAlertModal.classList.add('visible');
}

function showCustomConfirm(message, title = 'Confirmar') {
    // Devolvemos una promesa
    return new Promise((resolve) => {
        if (!genericConfirmModal || !genericConfirmTitle || !genericConfirmMessage || !genericConfirmOkBtn || !genericConfirmCancelBtn) {
            console.error("Faltan elementos del modal de confirmación. Usando confirm() nativo.");
            resolve(confirm(message)); // Fallback al confirm nativo
            return;
        }

        genericConfirmTitle.textContent = title;
        genericConfirmMessage.textContent = message;

        genericConfirmModal.classList.add('visible');

        // --- LÓGICA DE CLONACIÓN CORREGIDA ---

        // 1. Clonar los botones para eliminar listeners antiguos
        const newOkBtn = genericConfirmOkBtn.cloneNode(true);
        const newCancelBtn = genericConfirmCancelBtn.cloneNode(true);

        // 2. Reemplazarlos en el DOM
        genericConfirmOkBtn.parentNode.replaceChild(newOkBtn, genericConfirmOkBtn);
        genericConfirmCancelBtn.parentNode.replaceChild(newCancelBtn, genericConfirmCancelBtn);

        // 3. RE-ASIGNAR las variables globales (que ahora son 'let')
        //    para que apunten a los *nuevos* botones que están en el DOM.
        //    Esto es VITAL para la *próxima* vez que se llame a la función.
        genericConfirmOkBtn = newOkBtn;
        genericConfirmCancelBtn = newCancelBtn;

        // 4. Añadir listeners a los *nuevos* botones
        genericConfirmOkBtn.addEventListener('click', () => {
            genericConfirmModal.classList.remove('visible');
            resolve(true); // Resuelve la promesa como verdadero
        }, { once: true }); // 'once: true' asegura que el listener se ejecute solo una vez

        // Listener para Cancelar
        genericConfirmCancelBtn.addEventListener('click', () => {
            genericConfirmModal.classList.remove('visible');
            resolve(false); // Resuelve la promesa como falso
        }, { once: true });
    });
}


function renderizarPreguntaActiva() {
    if (cuestionario.preguntas.length === 0) {
        questionContentArea.innerHTML = '<p>Añade una pregunta para comenzar.</p>';
        return;
    }
    // Asegurarse de que el índice es válido
    if (preguntaActualIndex >= cuestionario.preguntas.length) {
        preguntaActualIndex = cuestionario.preguntas.length - 1;
    }
    if (!cuestionario.preguntas[preguntaActualIndex]) return; // Doble chequeo por si acaso

    const pregunta = cuestionario.preguntas[preguntaActualIndex];

    // --- 1. Lógica para las respuestas (Min 2, Max 6) ---
    let respuestasHTML = '';
    if (pregunta.tipo_pregunta === 'opcion_multiple') {
        const mostrarBotonEliminar = pregunta.respuestas.length > 2;
        respuestasHTML = pregunta.respuestas.map((resp, i) => `
            <div class="respuesta-editor">
                <input type="text" class="input-respuesta" data-index="${i}" value="${resp.texto_respuesta || ''}" placeholder="Escribe la respuesta ${i + 1}">
                <label class="checkbox-label"><input type="checkbox" class="checkbox-correcta" data-index="${i}" ${resp.es_correcta ? 'checked' : ''}></label>
                ${mostrarBotonEliminar ? `<button type="button" class="btn-eliminar-respuesta" data-index="${i}" title="Eliminar respuesta">&times;</button>` : ''}
            </div>
        `).join('');
    } else { // Verdadero/Falso
      respuestasHTML = `
            <div class="respuesta-editor"><input type="text" value="Verdadero" readonly><label class="checkbox-label"><input type="checkbox" class="checkbox-correcta" data-index="0" ${pregunta.respuestas[0]?.es_correcta ? 'checked' : ''}></label></div>
            <div class="respuesta-editor"><input type="text" value="Falso" readonly><label class="checkbox-label"><input type="checkbox" class="checkbox-correcta" data-index="1" ${pregunta.respuestas[1]?.es_correcta ? 'checked' : ''}></label></div>`;
    }

    // --- 2. Lógica de Media (Subir Local / URL / Borrar) ---

    // ===== ¡INICIO DE LA CORRECCIÓN IMPORTANTE! =====
    // Comprueba si url_media es un string válido y no solo "null" o un espacio vacío
    const hasValidMedia = pregunta.url_media && pregunta.url_media.trim() !== '' && pregunta.url_media !== 'null';

    const mediaPreviewHTML = hasValidMedia
        ? `<div class="media-preview" id="media-preview-${preguntaActualIndex}" style="display: block;">
               <img src="${pregunta.url_media}" alt="Vista previa">
               <button class="btn-remove-media" data-index="${preguntaActualIndex}">&times;</button>
           </div>`
        // Si no existe, crea el div pero lo deja oculto.
        : `<div class="media-preview" id="media-preview-${preguntaActualIndex}" style="display: none;"></div>`;

    // El placeholder solo se muestra si 'hasValidMedia' es falso.
    const placeholderHTML = `<div class="media-upload-placeholder" id="media-placeholder-${preguntaActualIndex}" style="${hasValidMedia ? 'display: none;' : 'display: flex;'}">
                                <svg width="24" height="24" viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 .01S15 9.32 15 11h-2c0-1.68-1.99-1.99-2-2S9 7 7 7v2s1.99 0 2 .01S11 10.68 11 12.35V17h2v-4.65c0-1.68 1.99-1.99 2-2S17 9 19 7zM5 5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V5zm2 0v14h10V5H7z"/></svg>
                                <span>Subir Imagen</span>
                           </div>`;

    // El input de URL solo se rellena si la media NO es un base64 (data:...)
    const urlInputValue = (hasValidMedia && !pregunta.url_media.startsWith('data:')) ? pregunta.url_media : '';
    // ===== ¡FIN DE LA CORRECCIÓN IMPORTANTE! =====

    // --- 3. Renderizar HTML Completo ---
    questionContentArea.innerHTML = `
        <div class="pregunta-editor">
            <div class="pregunta-header"><h3>Pregunta ${preguntaActualIndex + 1}</h3><button class="btn-eliminar-pregunta">Eliminar</button></div>

            <textarea class="input-pregunta" placeholder="Escribe tu pregunta aquí...">${pregunta.texto_pregunta || ''}</textarea>

            <div class="pregunta-media-container">
                <label>Imagen/Media (Opcional)</label>
                <div class="pregunta-image-upload" data-index="${preguntaActualIndex}">
                    ${mediaPreviewHTML}
                    ${placeholderHTML}
                    <input type="file" class="input-media-file" data-index="${preguntaActualIndex}" accept="image/*" style="display: none;">
                </div>
                <div class="media-separator">O</div>
                <input type="url" class="input-media-url" placeholder="Pega una URL de imagen aquí..." value="${urlInputValue}">
            </div>

            <h4>Respuestas:</h4>
            <div class="respuestas-container">${respuestasHTML}</div>

            ${(pregunta.tipo_pregunta === 'opcion_multiple' && pregunta.respuestas.length < 6) ? '<button class="btn-agregar-respuesta">+ Añadir opción</button>' : ''}
        </div>`;

    sincronizarSelectoresConDatos();
}

    // --- MANEJO DE EVENTOS ---


function configurarEventListenersGenerales() {
    addQuestionBtnContainer.innerHTML = `<button id="addNewQuestion" class="btn btn-primary">Añadir Pregunta</button>`;
    document.getElementById('addNewQuestion').addEventListener('click', agregarNuevaPregunta);

    if (simpleAlertOkBtn) {
        simpleAlertOkBtn.addEventListener('click', () => {
            simpleAlertModal.classList.remove('visible');
        });
    }

    // --- LISTENER PARA 'input' (mientras escribes en campos de texto) ---
    questionContentArea.addEventListener('input', (e) => {
        // Asegúrate de que haya una pregunta seleccionada
        if (!cuestionario.preguntas[preguntaActualIndex]) return;
        const pregunta = cuestionario.preguntas[preguntaActualIndex];

        // Actualizar texto de la pregunta
        if (e.target.classList.contains('input-pregunta')) {
            pregunta.texto_pregunta = e.target.value;
        }

        // Actualizar texto de la respuesta
        if (e.target.classList.contains('input-respuesta')) {
            pregunta.respuestas[e.target.dataset.index].texto_respuesta = e.target.value;
        }

        // ===== Lógica para la URL de Media (CORRECTA) =====
        if (e.target.classList.contains('input-media-url')) {
            const url = e.target.value.trim();
            pregunta.url_media = url; // Guarda la URL

            const previewContainer = document.getElementById(`media-preview-${preguntaActualIndex}`);
            const placeholder = document.getElementById(`media-placeholder-${preguntaActualIndex}`);

            if (url) {
                // Si se pega una URL, muestra la vista previa y el botón de borrar
                previewContainer.innerHTML = `<img src="${url}" alt="Vista previa"><button class="btn-remove-media" data-index="${preguntaActualIndex}">&times;</button>`;
                previewContainer.style.display = 'block';
                placeholder.style.display = 'none';

                // Limpia el input de archivo (por si había uno seleccionado)
                const fileInput = questionContentArea.querySelector(`.input-media-file[data-index="${preguntaActualIndex}"]`);
                if (fileInput) fileInput.value = '';
            } else {
                // Si la URL se borra, muestra el placeholder (solo si no hay archivo subido)
                const fileInput = questionContentArea.querySelector(`.input-media-file[data-index="${preguntaActualIndex}"]`);
                if (!fileInput || !fileInput.value) {
                    previewContainer.innerHTML = '';
                    previewContainer.style.display = 'none';
                    placeholder.style.display = 'flex';
                }
            }
        }
    });

// REEMPLAZA TU FUNCIÓN 'change' COMPLETA POR ESTA:
questionContentArea.addEventListener('change', async (e) => {
    // Asegúrate de que haya una pregunta seleccionada
    if (!cuestionario.preguntas[preguntaActualIndex]) return;
    const pregunta = cuestionario.preguntas[preguntaActualIndex];

    // --- 👇 INICIO DE LÓGICA FALTANTE (CHECKBOX) 👇 ---
    if (e.target.classList.contains('checkbox-correcta')) {
        const index = parseInt(e.target.dataset.index, 10);

        if (pregunta.tipo_pregunta === 'verdadero_falso' || pregunta.opcion_respuesta === 'simple') {
            // Desmarca todas las demás
            pregunta.respuestas.forEach((r, i) => r.es_correcta = (i === index) ? e.target.checked : false);
            renderizarPreguntaActiva(); // Re-renderiza para desmarcar otros
        } else { // Selección múltiple
            const totalRespuestas = pregunta.respuestas.length;
            const respuestasCorrectasActuales = pregunta.respuestas.filter(r => r.es_correcta).length;
            const isTryingToCheck = e.target.checked;

            // Evitar que todas las respuestas sean correctas
            if (isTryingToCheck && respuestasCorrectasActuales >= totalRespuestas - 1 && totalRespuestas > 1) {
                showCustomAlert(`No puedes marcar todas las respuestas como correctas. Al menos una debe ser incorrecta.`, "Error de validación", "error");
                e.target.checked = false;
            } else {
                pregunta.respuestas[index].es_correcta = e.target.checked;
            }
        }
        return; // Importante: Salir después de manejar el checkbox
    }
    // --- FIN DE LÓGICA FALTANTE (CHECKBOX) ---


    // --- LÓGICA DE SUBIDA DE ARCHIVO (Esta ya la tenías) ---
    if (e.target.classList.contains('input-media-file')) {
        const file = e.target.files[0];
        const index = parseInt(e.target.dataset.index, 10); // Asegúrate que sea número

        if (!file || index !== preguntaActualIndex) return;

        const placeholder = document.getElementById(`media-placeholder-${index}`);
        const previewContainer = document.getElementById(`media-preview-${index}`);
        if(placeholder) placeholder.innerHTML = 'Subiendo...';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload/image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Error al subir la imagen');
            }

            cuestionario.preguntas[index].url_media = result.url;

            if (previewContainer) {
                previewContainer.innerHTML = `<img src="${result.url}" alt="Vista previa"><button class="btn-remove-media" data-index="${index}">&times;</button>`;
                previewContainer.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            const urlInput = questionContentArea.querySelector('.input-media-url');
            if (urlInput) urlInput.value = '';

        } catch (error) {
            console.error('Error al subir imagen:', error);
            showCustomAlert(`Error: ${error.message}`, "Error de subida", "error"); // Usamos el modal
            if(placeholder) {
                 placeholder.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 .01S15 9.32 15 11h-2c0-1.68-1.99-1.99-2-2S9 7 7 7v2s1.99 0 2 .01S11 10.68 11 12.35V17h2v-4.65c0-1.68 1.99-1.99 2-2S17 9 19 7zM5 5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V5zm2 0v14h10V5H7z"/></svg><span>Subir Imagen</span>`;
                 placeholder.style.display = 'flex';
            }
             if (previewContainer) previewContainer.style.display = 'none';
        } finally {
             e.target.value = '';
        }
    }
}); // Fin del listener 'change'

    // --- LISTENER PARA 'click' (botones de eliminar, agregar, etc.) ---
    questionContentArea.addEventListener('click', (e) => {
        // Asegúrate de que haya una pregunta seleccionada
        if (!cuestionario.preguntas[preguntaActualIndex]) return;
        const pregunta = cuestionario.preguntas[preguntaActualIndex]; // Definir 'pregunta' aquí

        // Botón Eliminar Pregunta
        if (e.target.classList.contains('btn-eliminar-pregunta')) {
            eliminarPregunta(preguntaActualIndex);
            return; // Salir para evitar otros clics
        }

        // Botón Agregar Respuesta
        if (e.target.classList.contains('btn-agregar-respuesta')) {
            // ===== MODIFICACIÓN: Comprobar límite de 6 =====
            if (pregunta.respuestas.length < 6) {
                pregunta.respuestas.push({ texto_respuesta: '', es_correcta: false });
                renderizarTodo(); // Usar renderTodo() para actualizar todo (incluido el botón de añadir)
            } else {
                alert("No se pueden añadir más de 6 respuestas.");
            }
            return; // Salir
        }

        // ===== INICIO BLOQUE AÑADIDO (Eliminar Respuesta) =====
       // ===== INICIO BLOQUE MODIFICADO (Eliminar Respuesta) =====
    if (e.target.classList.contains('btn-eliminar-respuesta')) {
     // Comprobar límite de 2
    if (pregunta.respuestas.length > 2) {
     const indexToDelete = parseInt(e.target.dataset.index, 10);

     // 1. Elimina la respuesta del array
    pregunta.respuestas.splice(indexToDelete, 1);

    // --- 💡 INICIO DE LA NUEVA VALIDACIÓN 💡 ---
    // Si es selección múltiple, revisamos que no queden todas marcadas
     if (pregunta.opcion_respuesta === 'multiple') {
    const totalActual = pregunta.respuestas.length;
     const correctasActuales = pregunta.respuestas.filter(r => r.es_correcta).length;

     // 2. Si TODAS las respuestas restantes son correctas (y hay más de una), las reseteamos.
    if (correctasActuales === totalActual && totalActual > 1) {
     pregunta.respuestas.forEach(r => r.es_correcta = false);
    // 3. Avisamos al usuario
     showCustomAlert('Se han desmarcado las respuestas. No todas las opciones pueden ser correctas.', 'Aviso', 'info');
    }
     }
    // --- 💡 FIN DE LA NUEVA VALIDACIÓN 💡 ---

    // 4. Re-renderiza la pregunta con los datos actualizados
             renderizarTodo();

    } else {
     // Ya tenías esta alerta, está perfecta
     alert("Debe haber un mínimo de 2 respuestas.");
     }
     return; // Salir
     }
     // ===== FIN BLOQUE MODIFICADO =====



        // ===== FIN BLOQUE AÑADIDO =====

        // Clic en el Placeholder para subir imagen
        if (e.target.closest('.media-upload-placeholder')) {
            const fileInput = questionContentArea.querySelector(`.input-media-file[data-index="${preguntaActualIndex}"]`);
            if (fileInput) {
                fileInput.click();
            }
            return; // Salir
        }

        // Clic en el botón 'x' para eliminar media
        if (e.target.classList.contains('btn-remove-media')) {
            e.preventDefault();
            const index = e.target.dataset.index;
            if (index != preguntaActualIndex) return;

            cuestionario.preguntas[index].url_media = null; // Borra el dato

            // Limpiar inputs
            const fileInput = questionContentArea.querySelector(`.input-media-file[data-index="${index}"]`);
            if (fileInput) fileInput.value = '';
            const urlInput = questionContentArea.querySelector('.input-media-url');
            if (urlInput) urlInput.value = '';

            // Mostrar placeholder, ocultar preview
            const previewContainer = document.getElementById(`media-preview-${index}`);
            const placeholder = document.getElementById(`media-placeholder-${index}`);
            if (previewContainer) {
                previewContainer.innerHTML = '';
                previewContainer.style.display = 'none';
            }
            if (placeholder) placeholder.style.display = 'flex';
            return; // Salir
        }
    });

    // --- LISTENER PARA EL BOTÓN DE VISTA PREVIA ---
    const botones = document.querySelectorAll('.header-buttons .btn-secondary');
    const vistaPreviewBtn = Array.from(botones).find(btn => btn.textContent.includes('Vista previa'));

    if (vistaPreviewBtn) {
        vistaPreviewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            abrirVistaPrevia();
        });
        console.log('✅ Botón Vista Previa configurado correctamente');
    }

    // Listener del botón de guardar principal
    btnGuardarCuestionario.addEventListener('click', () => {
        const errores = validarCuestionario();
        if (errores.length > 0) {
            mostrarModalErrores(errores);
            return;
        }
        if (successModal) {
            successModal.classList.add('visible');
        }
    });

    // Listeners modal de errores
    if (btnVolverAEditarDesdeError) {
        btnVolverAEditarDesdeError.addEventListener('click', () => {
            validationModal.classList.remove('visible');
        });
    }


    // Listener botón guardar final (modal de éxito)
    const btnGuardarFinal = document.getElementById('btnGuardarFinal');
if (btnGuardarFinal) {
    // Convertimos el listener a async para usar await
    btnGuardarFinal.addEventListener('click', async () => {
        const mensajeConfirmacion = idCuestionarioEditando !== null
            ? '¿Estás seguro de que quieres actualizar el cuestionario?'
            : '¿Estás seguro de que quieres guardar el cuestionario?';

        // Usamos el modal personalizado en lugar de confirm()
        const confirmado = await showCustomConfirm(mensajeConfirmacion, 'Confirmar Guardado');

        if (confirmado) {
            guardarCuestionarioCompleto();
        }
    });
}

    // Listeners modal eliminar pregunta
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            confirmDeleteModal.classList.remove('visible');
            indexToDelete = null;
        });
    }
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (indexToDelete !== null) {
                cuestionario.preguntas.splice(indexToDelete, 1);
                preguntaActualIndex = Math.max(0, indexToDelete - 1);
                renderizarTodo();
                confirmDeleteModal.classList.remove('visible');
                indexToDelete = null;
            }
        });
    }

    // Listener botón "Clases" (modal de éxito)
    const botonClases = document.querySelector('.options-list a[href*="sala_profesor"]');
    if (botonClases) {
        botonClases.addEventListener('click', async (e) => {
            e.preventDefault();

            // Asigna el ID del cuestionario guardado (ya sea nuevo o editado)
            if (idCuestionarioEditando) {
                idCuestionarioGuardado = idCuestionarioEditando;
            }

            if (!idCuestionarioGuardado) {
                alert("Primero guarda el cuestionario.");
                return;
            }

            try {
                const res = await fetch('/api/iniciar_sesion_clase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_cuestionario: idCuestionarioGuardado })
                });
                const data = await res.json();
                if (data.success && data.pin) {
                    window.location.href = `/sala_profesor?pin=${encodeURIComponent(data.pin)}`;
                } else {
                    alert("Error al iniciar la sesión: " + (data.message || "Desconocido"));
                }
            } catch (err) {
                console.error(err);
                alert("Error de conexión al intentar iniciar la clase.");
            }
        });
    }
}

    // --- LÓGICA DE PREGuntas ---
  function agregarNuevaPregunta() {
    cuestionario.preguntas.push({
        texto_pregunta: '',
        tipo_pregunta: 'opcion_multiple',
        tiempo_limite_segundos: 30,
        puntos: 1,
        opcion_respuesta: 'simple',
        url_media: null, // <-- Asegúrate que esta línea exista (o '' o null)
        respuestas: [{ texto_respuesta: '', es_correcta: false }, { texto_respuesta: '', es_correcta: false }],
        respuestas_quiz_guardadas: [{ texto_respuesta: '', es_correcta: false }, { texto_respuesta: '', es_correcta: false }]
    });
    preguntaActualIndex = cuestionario.preguntas.length - 1;
    renderizarTodo();
}

    // ▼▼▼ CAMBIO 2: La función `eliminarPregunta` ahora solo abre el modal de confirmación ▼▼▼
    function eliminarPregunta(index) {
        if (cuestionario.preguntas.length <= 1) {
            showCustomAlert('No puedes eliminar la última pregunta.', "Acción no permitida", "error");
            return;
        }

        // Guardamos el índice de la pregunta que se quiere borrar
        indexToDelete = index;

        // Mostramos el modal de confirmación personalizado
        if (confirmDeleteModal) {
            confirmDeleteModal.classList.add('visible');
        }
    }

    // --- MODALES (Sin cambios) ---
// REEMPLAZA tu 'configurarModalAjustes' con esta versión:

function configurarModalAjustes() {
    const modal = document.getElementById('ajustesModal');

    document.getElementById('btnAjustes').addEventListener('click', () => {
        // 1. Cargar datos (esto está bien)
        document.getElementById('tituloInput').value = cuestionario.titulo;
        document.getElementById('descripcionInput').value = cuestionario.descripcion;
        document.querySelector(`input[name="visibilidad"][value="${cuestionario.visibilidad}"]`).checked = true;

        // 2. Sincronizar la visualización de la imagen al abrir (Lógica para Imagen de Portada)
        const imagePreviewDiv = document.getElementById('imagePreview');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        const imageUploadArea = document.getElementById('imageUploadArea');

        // ===== INICIO DE LA MODIFICACIÓN =====
        // Necesitamos la referencia al input de la URL
        const portadaUrlInput = document.getElementById('portadaUrlInput');

        if (cuestionario.imagen_portada) {
            document.getElementById('previewImage').src = cuestionario.imagen_portada;
            imagePreviewDiv.style.display = 'block';
            uploadPlaceholder.style.opacity = '0';
            imageUploadArea.style.border = 'none';

            // Si la imagen guardada NO es Base64 (es una URL), la ponemos en el input
            if (!cuestionario.imagen_portada.startsWith('data:')) {
                portadaUrlInput.value = cuestionario.imagen_portada;
            } else {
                portadaUrlInput.value = ''; // Limpiamos si es Base64
            }
        } else {
            // No hay imagen, reseteamos todo
            imagePreviewDiv.style.display = 'none';
            uploadPlaceholder.style.opacity = '1';
            imageUploadArea.style.border = '2px dashed #ddd';
            portadaUrlInput.value = '';
        }
        // ===== FIN DE LA MODIFICACIÓN =====

        modal.classList.add('visible');
    });

    document.getElementById('cancelarAjustesBtn').addEventListener('click', () => modal.classList.remove('visible'));

    document.getElementById('guardarAjustesBtn').addEventListener('click', () => {
        // 1. Guardar datos del cuestionario en el objeto global
        cuestionario.titulo = document.getElementById('tituloInput').value.trim();
        cuestionario.descripcion = document.getElementById('descripcionInput').value.trim();
        cuestionario.visibilidad = document.querySelector('input[name="visibilidad"]:checked').value;

        // ===== INICIO DE LA MODIFICACIÓN =====
        // 2. Lógica de guardado de imagen (la URL tiene prioridad)
        const urlInput = document.getElementById('portadaUrlInput').value.trim();

        if (urlInput) {
            // Si el usuario escribió una URL, esa es la que guardamos
            cuestionario.imagen_portada = urlInput;
            // Limpiamos el input de archivo por si acaso
            document.getElementById('portadaInput').value = '';
        }
        // Si no hay URL, 'cuestionario.imagen_portada' ya tiene el valor
        // correcto (ya sea el Base64 subido o null) gracias a 'configurarManejoPortada'
        // ===== FIN DE LA MODIFICACIÓN =====

        modal.classList.remove('visible');
    });
}

    function configurarModalesComplejos() {
    console.log("Configurando modales complejos...");

    const rewardsModal = document.getElementById('rewardsModal');
    const successModal = document.getElementById('successModal');
    const openRewardsBtn = document.getElementById('openRewardsModalBtn');
    const saveRewardsBtn = document.getElementById('saveRewardsBtn');
    const btnVolverAEditar = document.getElementById('btnVolverAEditar');
    const btnVolverDesdeRecompensas = document.getElementById('btnVolverDesdeRecompensas');

    // Verificación de seguridad
    if (!openRewardsBtn) {
        console.error("❌ ERROR CRÍTICO: No se encontró el botón 'openRewardsModalBtn'. Revisa el HTML.");
        return;
    }

    // 1. Abrir modal de recompensas (desde el modal de éxito)
    openRewardsBtn.addEventListener('click', () => {
        console.log("🔘 Clic en 'Establecer recompensas'");

        // Cargar datos actuales en los inputs
        const rec1 = cuestionario.recompensas[0] ? cuestionario.recompensas[0].descripcion : '';
        const rec2 = cuestionario.recompensas[1] ? cuestionario.recompensas[1].descripcion : '';
        const rec3 = cuestionario.recompensas[2] ? cuestionario.recompensas[2].descripcion : '';

        const input1 = document.getElementById('recompensa-1');
        const input2 = document.getElementById('recompensa-2');
        const input3 = document.getElementById('recompensa-3');

        if (input1) input1.value = rec1;
        if (input2) input2.value = rec2;
        if (input3) input3.value = rec3;

        // Ocultar éxito, mostrar recompensas
        if (successModal) successModal.classList.remove('visible');
        if (rewardsModal) rewardsModal.classList.add('visible');
    });

    // 2. Guardar recompensas y volver
    if (saveRewardsBtn) {
        saveRewardsBtn.addEventListener('click', () => {
            const desc1 = document.getElementById('recompensa-1')?.value.trim() || '';
            const desc2 = document.getElementById('recompensa-2')?.value.trim() || '';
            const desc3 = document.getElementById('recompensa-3')?.value.trim() || '';

            // Guardar en el objeto global
            cuestionario.recompensas = [
                { descripcion: desc1 },
                { descripcion: desc2 },
                { descripcion: desc3 }
            ].filter(r => r.descripcion !== '');

            console.log("✅ Recompensas guardadas:", cuestionario.recompensas);

            if (rewardsModal) rewardsModal.classList.remove('visible');
            if (successModal) successModal.classList.add('visible');
        });
    }

    // 3. Volver sin guardar
    if (btnVolverDesdeRecompensas) {
        btnVolverDesdeRecompensas.addEventListener('click', () => {
            if (rewardsModal) rewardsModal.classList.remove('visible');
            if (successModal) successModal.classList.add('visible');
        });
    }

    // 4. Volver a editar (desde éxito)
    if (btnVolverAEditar) {
        btnVolverAEditar.addEventListener('click', () => {
            if (successModal) successModal.classList.remove('visible');
        });
    }
}
    // --- SELECTORES PERSONALIZADOS (Sin cambios) ---
function configurarSelectoresPersonalizados() {
    const wrappers = document.querySelectorAll('.custom-select-wrapper');
    wrappers.forEach(wrapper => {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const options = wrapper.querySelectorAll('.custom-option');
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wrapper.classList.contains('disabled')) return;
            const isOpen = wrapper.querySelector('.custom-select-options').classList.contains('show');
            document.querySelectorAll('.custom-select-options').forEach(opt => opt.classList.remove('show'));
            if (!isOpen) wrapper.querySelector('.custom-select-options').classList.add('show');
        });
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                const pregunta = cuestionario.preguntas[preguntaActualIndex];
                const label = wrapper.parentElement.querySelector('.config-label').textContent;

                if (label === 'Tipo de pregunta') {
                    const previousType = pregunta.tipo_pregunta;
                    pregunta.tipo_pregunta = value;

                    if (value === 'verdadero_falso') {
                        // 1. Guardar las respuestas actuales de Quiz antes de cambiarlas a V/F
                        pregunta.respuestas_quiz_guardadas = JSON.parse(JSON.stringify(pregunta.respuestas));

                        // 2. Aplicar las respuestas de V/F
                        pregunta.respuestas = [
                            { texto_respuesta: 'Verdadero', es_correcta: false },
                            { texto_respuesta: 'Falso', es_correcta: false }
                        ];
                        pregunta.opcion_respuesta = 'simple';
                    }
                    else if (value === 'opcion_multiple') {
                        // 1. Restaurar las respuestas guardadas de Quiz
                        if (previousType === 'verdadero_falso') {
                            pregunta.respuestas = JSON.parse(JSON.stringify(pregunta.respuestas_quiz_guardadas));
                        }
                        // 2. Asegurarse de que al menos haya 2 respuestas si la copia estaba vacía
                        if (pregunta.respuestas.length < 2) {
                             pregunta.respuestas = [{ texto_respuesta: '', es_correcta: false }, { texto_respuesta: '', es_correcta: false }];
                        }
                        pregunta.opcion_respuesta = 'simple'; // Valor por defecto
                    }

                    renderizarTodo();

                    } else if (label === 'Límite de tiempo') {
                        pregunta.tiempo_limite_segundos = parseInt(value, 10);
                        // 💡 Llama a sincronizar para actualizar el texto del trigger
                        sincronizarSelectoresConDatos();
                    } else if (label === 'Puntos') {
                        pregunta.puntos = parseInt(value, 10);
                        // 💡 Llama a sincronizar para actualizar el texto del trigger
                        sincronizarSelectoresConDatos();
                    } else if (label === 'Opciones de respuesta') {
                    pregunta.opcion_respuesta = value;

                    // Lógica para desmarcar múltiples checks al pasar a Selección Simple
                    if (value === 'simple') {
                        let correctasActuales = pregunta.respuestas.filter(r => r.es_correcta).length;
                        if (correctasActuales > 1) {
                            pregunta.respuestas.forEach(r => r.es_correcta = false);
                        }
                    }

                    sincronizarSelectoresConDatos();
                    renderizarPreguntaActiva();
                }

            });
        });
    });
    window.addEventListener('click', () => document.querySelectorAll('.custom-select-options').forEach(opt => opt.classList.remove('show')));
}
    function sincronizarSelectoresConDatos() {
        const pregunta = cuestionario.preguntas[preguntaActualIndex];
        const selectors = document.querySelectorAll('.question-config .config-item');
        selectors[0].querySelector('.custom-select-trigger span').textContent = pregunta.tipo_pregunta === 'opcion_multiple' ? 'Quiz (Opción múltiple)' : 'Verdadero/Falso';
        const timeOption = selectors[1].querySelector(`.custom-option[data-value="${pregunta.tiempo_limite_segundos}"]`);
        selectors[1].querySelector('.custom-select-trigger span').textContent = timeOption ? timeOption.textContent : '30 segundos';
        const pointsOption = selectors[2].querySelector(`.custom-option[data-value="${pregunta.puntos}"]`);
        selectors[2].querySelector('.custom-select-trigger span').textContent = pointsOption ? pointsOption.textContent : 'Estándar';
        const answerOption = selectors[3].querySelector(`.custom-option[data-value="${pregunta.opcion_respuesta}"]`);
        selectors[3].querySelector('.custom-select-trigger span').textContent = answerOption ? answerOption.textContent : 'Selección simple';
        if (pregunta.tipo_pregunta === 'verdadero_falso') {
            selectors[3].querySelector('.custom-select-wrapper').classList.add('disabled');
        } else {
            selectors[3].querySelector('.custom-select-wrapper').classList.remove('disabled');
        }
    }

    async function guardarCuestionarioCompleto(estado = 'activo') {
    if (!cuestionario.titulo.trim() || cuestionario.titulo === "Cuestionario sin título") {
       showCustomAlert("Por favor, añade un título al cuestionario en 'Ajustes'.", "Información incompleta", "error");
        return;
    }
    if (cuestionario.preguntas.length === 0 && estado === 'activo') {
        alert("Debes añadir al menos una pregunta para finalizar.");
        return;
    }

   const estadoFinal = estado === 'activo' ? 'activo' : 'borrador';

    const datosParaEnviar = {
        titulo: cuestionario.titulo,
        descripcion: cuestionario.descripcion,
        visibilidad: cuestionario.visibilidad,
        imagen_portada: cuestionario.imagen_portada,
        estado: estadoFinal,

        preguntas: cuestionario.preguntas.map(p => ({
            texto_pregunta: p.texto_pregunta,
            url_media: p.url_media, // <-- AÑADIR ESTA LÍNEA
            tipo_pregunta: p.tipo_pregunta,
            tiempo_limite: p.tiempo_limite_segundos,
            puntos: mapearPuntosParaBD(p.puntos),
            opcion_rpta: mapearOpcionRptaParaBD(p.opcion_respuesta),
            respuestas: p.respuestas
        })),
        recompensas: cuestionario.recompensas
    };

    const esEdicion = idCuestionarioEditando !== null;
    const url = esEdicion ? `/api/cuestionario/${idCuestionarioEditando}` : '/api/cuestionario';
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosParaEnviar)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'Error desconocido al guardar');
        }

        const result = await response.json();

        // ✅ Asignar ID correctamente
        if (esEdicion) {
            idCuestionarioGuardado = idCuestionarioEditando;
        } else {
            idCuestionarioGuardado = result.id_cuestionario;
        }

        // Si es borrador, redirigir y salir
        if (estadoFinal === 'borrador') {
            alert('Cuestionario guardado como borrador con éxito.');
            const redirectUrl = document.body.dataset.redirectUrl || '/inicioProfesores';
            window.location.href = redirectUrl;
            return;
        }

        showCustomAlert('¡Cuestionario guardado con éxito! Creando partida...', "Guardado");

        // Crear partida y obtener PIN
        const pinNuevo = await crearPartidaReal();

        // Redirigir a sala de profesor
        window.location.href = `/sala_profesor?pin=${encodeURIComponent(pinNuevo)}`;

    } catch (error) {
        console.error('Error en el flujo de guardado:', error);
        showCustomAlert(error.message, "Error al guardar", "error");
    }
}

// Reemplaza esta función en crear_cuestionario.js

// Reemplaza esta función en crear_cuestionario.js

async function cargarDatosDelCuestionario(id) {
    try {
        const response = await fetch(`/api/cuestionario/${id}`);
        if (!response.ok) throw new Error('No se pudo cargar el cuestionario.');
        const data = await response.json();

        cuestionario.titulo = data.titulo;
        cuestionario.descripcion = data.descripcion;
        cuestionario.visibilidad = data.visibilidad;
        cuestionario.recompensas = data.recompensas || [];
        cuestionario.imagen_portada = data.imagen_portada || null;

        cuestionario.preguntas = data.preguntas.map(p => ({
            id: p.id_pregunta,
            texto_pregunta: p.texto_pregunta,

            // ===== ¡AQUÍ ESTÁ LA CORRECCIÓN! =====
            // Limpia el dato: si es "null" (string), '', o null, lo convierte en null.
            url_media: (p.url_media && p.url_media !== 'null') ? p.url_media.trim() : null,
            // ======================================

            tipo_pregunta: p.tipo_pregunta,
            tiempo_limite_segundos: p.tiempo_limite_segundos,
            puntos: mapearPuntosParaFrontend(p.puntos),
            opcion_respuesta: mapearOpcionRptaParaFrontend(p.opcion_rpta),
            respuestas: p.respuestas.map(r => ({
                id: r.id_respuesta,
                texto_respuesta: r.texto_respuesta,
                es_correcta: r.es_correcta
            }))
        }));

        preguntaActualIndex = 0;
        renderizarTodo(); // Ahora renderiza con los datos limpios
    } catch (error) {
        console.error("Error cargando datos del cuestionario:", error);
        showCustomAlert(error.message, "Error al cargar", "error");
    }
}

    function validarCuestionario() {
    const erroresCuestionario = [];

    // Validar título (ya se valida en el listener de Guardar, pero lo incluimos por si acaso)
    if (!cuestionario.titulo.trim() || cuestionario.titulo === "Cuestionario sin título") {
        erroresCuestionario.push({
            tipo: 'general',
            mensaje: "Falta añadir el Título del cuestionario en 'Ajustes'."
        });
    }

    if (cuestionario.preguntas.length === 0) {
        erroresCuestionario.push({
            tipo: 'general',
            mensaje: "Debes añadir al menos una pregunta."
        });
        return erroresCuestionario;
    }

    cuestionario.preguntas.forEach((pregunta, index) => {
        const erroresPregunta = [];

        // 1. Falta pregunta
        if (!pregunta.texto_pregunta.trim()) {
            erroresPregunta.push("Falta pregunta");
        }

        // 2. Falta respuestas por escribir
        const respuestasVacias = pregunta.respuestas.filter(r => !r.texto_respuesta.trim()).length;
        if (respuestasVacias > 0) {
            erroresPregunta.push(`Falta(n) ${respuestasVacias} respuesta(s)`);
        }

        // 3. Respuesta correcta no seleccionada
        const correctas = pregunta.respuestas.filter(r => r.es_correcta).length;
        if (correctas === 0) {
            erroresPregunta.push("Respuesta correcta no seleccionada");
        }

        if (erroresPregunta.length > 0) {
            erroresCuestionario.push({
                index: index,
                numero: index + 1,
                errores: erroresPregunta
            });
        }
    });

    return erroresCuestionario;
}

function configurarManejoPortada() {
    const imageUploadArea = document.getElementById('imageUploadArea');
    const portadaInput = document.getElementById('portadaInput');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const imagePreviewDiv = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const portadaUrlInput = document.getElementById('portadaUrlInput');

    // Muestra la previsualización o el placeholder
    function updateImageDisplay(source) { // 'source' puede ser Base64 o una URL
        if (source) {
            previewImage.src = source;
            imagePreviewDiv.style.display = 'block';
            uploadPlaceholder.style.opacity = '0';
            imageUploadArea.style.border = 'none'; // Quita el borde punteado
        } else {
            imagePreviewDiv.style.display = 'none';
            uploadPlaceholder.style.opacity = '1';
            imageUploadArea.style.border = '2px dashed #ddd'; // Restaura el borde punteado
            previewImage.src = '';
        }
    }

    // 1. Manejar el clic en el área de subida (sin cambios)
    imageUploadArea.addEventListener('click', () => {
        if (imagePreviewDiv.style.display !== 'block') {
             portadaInput.click();
        }
    });

    // 2. Manejar la selección del archivo (Modificado)
    portadaInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                // ===== INICIO MODIFICACIÓN =====
                cuestionario.imagen_portada = event.target.result; // Guarda Base64
                updateImageDisplay(cuestionario.imagen_portada);
                // ===== INICIO CORRECCIÓN: Sincronizar con el input URL =====
                // Cuando el usuario carga una imagen por archivo, limpiar el input de URL
                portadaInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        portadaUrlInput.value = ''; // Limpia la URL si subes archivo
                    }
                });

                // Cuando el usuario limpia el input de URL, actualizar la visualización
                portadaUrlInput.addEventListener('blur', () => {
                    if (!portadaUrlInput.value.trim() && !cuestionario.imagen_portada) {
                        updateImageDisplay(null);
                    }
                });
                // ===== FIN CORRECCIÓN =====
                portadaUrlInput.value = ''; // Limpia el campo URL
                // ===== FIN MODIFICACIÓN =====
            };
            reader.readAsDataURL(file);
        }
    });

    // 3. Manejar la eliminación de la imagen (Modificado)
    removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que el clic abra el selector de archivos

        // ===== INICIO MODIFICACIÓN =====
        cuestionario.imagen_portada = null;
        portadaInput.value = ''; // Limpia el input file
        portadaUrlInput.value = ''; // Limpia también la URL
        updateImageDisplay(null);
        // ===== FIN MODIFICACIÓN =====
    });

    // ===== INICIO MODIFICACIÓN: 4. Añadir listener para la URL =====
    // (Este listener es nuevo)
    portadaUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            cuestionario.imagen_portada = url;
            portadaInput.value = ''; // Limpia el input de archivo
            updateImageDisplay(url); // Muestra la previsualización desde la URL
        } else {
            // Si el usuario borra la URL, reseteamos
            if (portadaInput.files.length === 0) { // Solo resetea si no hay un archivo subido
                 cuestionario.imagen_portada = null;
                 updateImageDisplay(null);
            }
        }
    });
    // ===== FIN MODIFICACIÓN =====


    // Llamar una vez para inicializar (Modificado)
    updateImageDisplay(cuestionario.imagen_portada);
}

function mostrarModalErrores(errores) {
    errorListContainer.innerHTML = '';

    errores.forEach(error => {
        // Manejar errores generales (ej. Título, No hay preguntas)
        if (error.tipo === 'general') {
            const generalError = document.createElement('div');
            generalError.className = 'error-item';
            generalError.textContent = error.mensaje;
            errorListContainer.appendChild(generalError);
        }
        // Manejar errores por pregunta
        else {
            const block = document.createElement('div');
            block.className = 'question-error-block';
            block.innerHTML = `
                <div class="question-error-header">
                    <span>${error.numero} - Quiz</span>
                    <button class="btn-reparar" data-index="${error.index}">Reparar</button>
                </div>
            `;
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.paddingLeft = '0';
            error.errores.forEach(errorText => {
                const li = document.createElement('li');
                li.className = 'error-item';
                li.innerHTML = `<span>${errorText}</span>`;
                ul.appendChild(li);
            });
            block.appendChild(ul);
            errorListContainer.appendChild(block);
        }
    });

    // Añadir listener para los botones "Reparar"
    errorListContainer.querySelectorAll('.btn-reparar').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            preguntaActualIndex = index; // Selecciona la pregunta con error
            validationModal.classList.remove('visible'); // Cierra el modal de error
            renderizarTodo(); // Muestra el editor de la pregunta
            // Opcional: enfocar el campo de la pregunta
            const inputPregunta = document.querySelector('.input-pregunta');
            if(inputPregunta) inputPregunta.focus();
        });
    });

    validationModal.classList.add('visible');
}

    // --- LÓGICA DEL MODAL DE COMPARTIR (Sin cambios) ---
    const modalCompartir = document.getElementById('modalCompartir');
    const btnAbrirModalCompartir = document.getElementById('abrirModalCompartir');
    const btnVolverExito = document.getElementById('btnVolverExito');
    const btnCopiarEnlace = document.getElementById('btnCopiarEnlace');
    const inputEnlace = document.getElementById('inputEnlaceCompartir');
    const btnCopiarPin = document.getElementById('btnCopiarPin');
    const inputPin = document.getElementById('inputPinJuego');


    const enlaceFacebook = document.getElementById('enlaceFacebook');
    const enlaceTwitter = document.getElementById('enlaceTwitter');
    const enlaceWhatsapp = document.getElementById('enlaceWhatsapp');
    const enlaceLinkedin = document.getElementById('enlaceLinkedin');
    function actualizarEnlacesSociales() {
        const urlParaCompartir = inputEnlace.value;
        const textoParaCompartir = encodeURIComponent(`¡Te reto a jugar mi nuevo cuestionario! Juega aquí: ${urlParaCompartir}`);
        const urlCodificada = encodeURIComponent(urlParaCompartir);
        if (enlaceFacebook) enlaceFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${urlCodificada}`;
        if (enlaceTwitter) enlaceTwitter.href = `https://twitter.com/intent/tweet?text=${textoParaCompartir}`;
        if (enlaceWhatsapp) enlaceWhatsapp.href = `https://api.whatsapp.com/send?text=${textoParaCompartir}`;
        if (enlaceLinkedin) enlaceLinkedin.href = `https://www.linkedin.com/shareArticle?mini=true&url=${urlCodificada}&title=¡Juega mi cuestionario!`;
    }
    if (btnAbrirModalCompartir) {
       if (btnAbrirModalCompartir) {
            btnAbrirModalCompartir.addEventListener('click', async () => {
                if (successModal) successModal.classList.remove('visible');
                try {
                    // ✅ Crear partida real si no existe
                    const pinReal = await crearPartidaReal();
                    // ✅ Mostrar PIN real en el modal
                    if (inputPin) {
                        inputPin.value = pinReal;
                    }
                    // ✅ Actualizar enlace
                    if (inputEnlace) {
                        const enlace = `${window.location.origin}/unirse?pin=${pinReal}`;
                        inputEnlace.value = enlace;
                    }
                    // ✅ Actualizar enlaces sociales
                    actualizarEnlacesSociales();
                    // ✅ Mostrar modal
                    if (modalCompartir) modalCompartir.classList.add('visible');
                } catch (err) {
                    alert("Error al preparar el compartir: " + err.message);
                }
            });
        }
    }

    if (btnVolverExito) {
        btnVolverExito.addEventListener('click', () => {
            if (modalCompartir) modalCompartir.classList.remove('visible');
            if (successModal) successModal.classList.add('visible');
        });
    }
    function copiarTexto(inputElemento, botonElemento) {
        inputElemento.select();
        navigator.clipboard.writeText(inputElemento.value).then(() => {
            const textoOriginal = botonElemento.textContent;
            botonElemento.textContent = '¡Copiado!';
            setTimeout(() => { botonElemento.textContent = textoOriginal; }, 2000);
        }).catch(err => console.error('Error al copiar:', err));
    }
    if (btnCopiarEnlace) {
        btnCopiarEnlace.addEventListener('click', () => copiarTexto(inputEnlace, btnCopiarEnlace));
    }
    if (btnCopiarPin) {
        btnCopiarPin.addEventListener('click', () => copiarTexto(inputPin, btnCopiarPin));
    }


    document.getElementById('abrirModalCompartir').closest('.options-list').querySelectorAll('.option-card')[0]
      .addEventListener('click', async (e) => {
        e.preventDefault();
        if (!idCuestionarioGuardado) {
          showCustomAlert("Primero guarda el cuestionario.", "Acción requerida", "info");
          return;
        }

        const res = await fetch('/api/iniciar_sesion_clase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_cuestionario: idCuestionarioGuardado })
        });
        const data = await res.json();
        if (data.success) {
          window.location.href = `/sala_profesor?pin=${data.pin}`;
        } else {
          alert("Error al iniciar la sesión: " + data.message);
        }
      });

      // ✅ FUNCIÓN REUTILIZABLE: crea partida real y devuelve el PIN

async function crearPartidaReal() {
    if (!idCuestionarioGuardado) {
        throw new Error("Error: El ID del cuestionario no se guardó. No se puede crear la partida.");
    }

    const res = await fetch('/api/iniciar_sesion_clase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cuestionario: idCuestionarioGuardado })
    });

    // --- ¡INICIO DE LA MODIFICACIÓN! ---
    // Revisamos qué tipo de contenido nos devolvió el servidor
    const contentType = res.headers.get("content-type");

    if (contentType && contentType.indexOf("application/json") !== -1) {
        // 1. El servidor SÍ devolvió JSON (el camino feliz)
        const data = await res.json();
        if (!data.success) {
            // El JSON tiene un mensaje de error del servidor
            throw new Error(data.message || "Error al crear la partida");
        }
        // ¡ÉXITO!
        return data.pin;

    } else {
        // 2. El servidor devolvió OTRA COSA (probablemente HTML)
        const errorHtml = await res.text(); // Leemos la respuesta como texto plano
        console.error("El servidor devolvió HTML en lugar de JSON:", errorHtml);

        // ¡Mostramos el error!
        // Esto reemplaza el "Unexpected token '<'"
        throw new Error("El servidor falló y devolvió HTML. Revisa los logs. Error: " + errorHtml.substring(0, 300) + "...");
    }
    // --- ¡FIN DE LA MODIFICACIÓN! ---
}

function abrirVistaPrevia() {
    if (cuestionario.preguntas.length === 0) {
        showCustomAlert('Añade al menos una pregunta para ver la vista previa.', 'No hay preguntas', 'info');
        return;
    }

    let previewModal = document.getElementById('previewModal');
    if (!previewModal) {
        previewModal = document.createElement('div');
        previewModal.id = 'previewModal';
        previewModal.className = 'modal-overlay';
        previewModal.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        previewModal.innerHTML = `
            <div class="fullscreen-preview-container">
                <div class="preview-exit-btn-container">
                    <button id="closePreviewBtn" class="btn-close-fullscreen">← Salir de vista previa</button>
                </div>

                <div class="preview-game-container">
                    <div id="previewQuestionArea" class="preview-question-area">
                    </div>
                </div>

                <div class="preview-nav-buttons">
                    <button id="prevPreviewQuestion" class="nav-btn-prev">← Pregunta anterior</button>
                    <span id="previewPageCounter" class="page-counter">1 / X</span>
                    <button id="nextPreviewQuestion" class="nav-btn-next">Siguiente pregunta →</button>
                </div>
            </div>
        `;
        document.body.appendChild(previewModal);

        previewModal.querySelector('#closePreviewBtn').addEventListener('click', () => {
            previewModal.classList.remove('visible');
        });

        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.classList.remove('visible');
            }
        });
    }

    previewModal.classList.add('visible');
    let currentPreviewIndex = 0;

    const renderPreview = (index) => {
        renderPreviewQuestionFullscreen(index);

        const prevBtn = previewModal.querySelector('#prevPreviewQuestion');
        const nextBtn = previewModal.querySelector('#nextPreviewQuestion');
        const counter = previewModal.querySelector('#previewPageCounter');

        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === cuestionario.preguntas.length - 1;
        counter.textContent = `${index + 1} / ${cuestionario.preguntas.length}`;
    };

    previewModal.querySelector('#prevPreviewQuestion').addEventListener('click', () => {
        if (currentPreviewIndex > 0) {
            currentPreviewIndex--;
            renderPreview(currentPreviewIndex);
        }
    });

    previewModal.querySelector('#nextPreviewQuestion').addEventListener('click', () => {
        if (currentPreviewIndex < cuestionario.preguntas.length - 1) {
            currentPreviewIndex++;
            renderPreview(currentPreviewIndex);
        }
    });

    renderPreview(currentPreviewIndex);
}

function renderPreviewQuestionFullscreen(index) {
    const pregunta = cuestionario.preguntas[index];
    const previewArea = document.getElementById('previewQuestionArea');

    if (!pregunta) return;

    let html = `
        <div class="preview-game-content">
            <!-- Imagen si existe -->
            ${pregunta.url_media ? `
                <div class="preview-image-area">
                    <img src="${pregunta.url_media}" alt="Pregunta" class="preview-game-image">
                </div>
            ` : ''}

            <!-- Pregunta -->
            <div class="preview-question-text-area">
                <h1 class="preview-game-question">${pregunta.texto_pregunta || 'Sin pregunta'}</h1>
            </div>

            <!-- Respuestas (como en el juego) -->
            <div class="preview-answers-area">
    `;

    if (pregunta.tipo_pregunta === 'opcion_multiple') {
        pregunta.respuestas.forEach((respuesta, i) => {
            const letraOpcion = String.fromCharCode(65 + i);
            const isCorrect = respuesta.es_correcta ? 'correct-answer' : '';
            html += `
                <div class="preview-answer-btn ${isCorrect}">
                    <span class="answer-letter">${letraOpcion}</span>
                    <span class="answer-text">${respuesta.texto_respuesta || 'Sin respuesta'}</span>
                    ${respuesta.es_correcta ? '<span class="correct-indicator">✓</span>' : ''}
                </div>
            `;
        });
    } else {
        const opciones = [
            { texto: 'Verdadero', index: 0 },
            { texto: 'Falso', index: 1 }
        ];
        opciones.forEach((opcion) => {
            const isCorrect = pregunta.respuestas[opcion.index]?.es_correcta ? 'correct-answer' : '';
            html += `
                <div class="preview-answer-btn vf-button ${isCorrect}">
                    <span class="answer-text">${opcion.texto}</span>
                    ${pregunta.respuestas[opcion.index]?.es_correcta ? '<span class="correct-indicator">✓</span>' : ''}
                </div>
            `;
        });
    }

    html += `
            </div>

            <!-- Metadatos de la pregunta -->
            <div class="preview-question-meta-info">
                <span class="meta-badge">⏱️ ${pregunta.tiempo_limite_segundos}s</span>
                <span class="meta-badge">⭐ ${
                    pregunta.puntos === 1 ? 'Estándar' :
                    pregunta.puntos === 2 ? 'Dobles' :
                    'Sin puntos'
                }</span>
                <span class="meta-badge">${pregunta.tipo_pregunta === 'opcion_multiple' ? '🎯 Quiz' : '✓/✗ V/F'}</span>
            </div>
        </div>
    `;

    previewArea.innerHTML = html;
}


    // --- INICIAR LA APLICACIÓN ---
    inicializar();
});

