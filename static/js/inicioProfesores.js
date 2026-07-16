document.addEventListener('DOMContentLoaded', function() {
    console.log('Script de Inicio Profesores cargado y listo para funcionar.');

    // --- LÓGICA PARA EL MENÚ DESPLEGABLE DEL PERFIL (sin cambios) ---
    const avatarButton = document.getElementById('avatar-button');
    const profileMenu = document.getElementById('profile-menu');
    if (avatarButton && profileMenu) {
        avatarButton.addEventListener('click', (event) => {
            event.stopPropagation();
            profileMenu.classList.toggle('hidden');
        });
        profileMenu.addEventListener('click', (event) => event.stopPropagation());
    }

    // --- SELECTORES DE ELEMENTOS DEL DOM ---
    const quizContainer = document.getElementById('quiz-list-container');
    const emptyMessage = document.getElementById('empty-message');
    const pageTitle = document.getElementById('page-title');
    const sideNavLinks = document.querySelectorAll('.side-nav-link');
    const modal = document.getElementById('confirm-trash-modal');
    const modalTitle = document.getElementById('trash-modal-title');
    const confirmTrashBtn = document.getElementById('confirm-trash-btn');
    const cancelTrashBtn = document.getElementById('cancel-trash-btn');
    const searchBar = document.querySelector('input[placeholder="Buscar en tus quizzes..."]');

    // 2. Asegurarnos de que la barra y el contenedor de quizzes existan
if (searchBar && quizContainer) {

    // 3. Añadir un "escuchador" para el evento 'input' (se activa cada vez que escribes)
    searchBar.addEventListener('input', function(event) {

        // 4. Obtener el texto de búsqueda (en minúsculas y sin espacios extra)
        const searchTerm = event.target.value.toLowerCase().trim();

        // 5. Obtener todas las tarjetas de quiz que están actualmente en el contenedor
        const quizzes = quizContainer.querySelectorAll('.repository-card');

        let quizEncontrado = false; // Para saber si mostramos un mensaje de "no hay resultados"

        // 6. Recorrer cada tarjeta de quiz
        quizzes.forEach(card => {
            // Obtener el texto del título de la tarjeta
            const titleElement = card.querySelector('.card-title');
            if (titleElement) {
                const title = titleElement.textContent.toLowerCase();

                // 7. Comprobar si el título incluye el texto de búsqueda
                if (title.includes(searchTerm)) {
                    card.style.display = 'block'; // Mostrar la tarjeta si coincide
                    quizEncontrado = true;
                } else {
                    card.style.display = 'none'; // Ocultar la tarjeta si no coincide
                }
            }
        });

        // 8. Manejar el mensaje de "lista vacía" o "sin resultados"
        if (emptyMessage) {
            // Primero, obtenemos la vista actual para saber qué mensaje de "vacío" mostrar
            const activeLink = document.querySelector('.side-nav-link.active');
            const vistaActiva = activeLink ? activeLink.dataset.view : 'activos'; // 'activos' por defecto

            if (quizEncontrado) {
                // Si encontramos al menos un quiz, ocultamos cualquier mensaje
                emptyMessage.classList.add('hidden');
            } else if (quizzes.length > 0 && searchTerm !== '') {
                // Si NO encontramos nada, pero SÍ HABÍA quizzes cargados (y no está vacía la búsqueda)
                emptyMessage.innerHTML = '<p>No se encontraron quizzes que coincidan con tu búsqueda.</p>';
                emptyMessage.classList.remove('hidden');
            } else {
                // Si NO encontramos nada y NO HABÍA quizzes (lista original vacía)
                // O si la barra de búsqueda está vacía
                if (vistaActiva === 'activos') {
                    emptyMessage.innerHTML = '<p>Aún no has creado ningún quiz.</p><p>Haz clic en "Nuevo Quiz" para empezar.</p>';
                } else {
                    emptyMessage.innerHTML = '<p>La papelera está vacía.</p>';
                }
                // Mostramos el mensaje solo si la lista original estaba vacía
                if (quizzes.length === 0) {
                     emptyMessage.classList.remove('hidden');
                }
            }

            // Caso especial: si el usuario borra la búsqueda, y la lista original estaba vacía
            if (searchTerm === '' && quizzes.length === 0) {
                 if (vistaActiva === 'activos') {
                    emptyMessage.innerHTML = '<p>Aún no has creado ningún quiz.</p><p>Haz clic en "Nuevo Quiz" para empezar.</p>';
                } else {
                    emptyMessage.innerHTML = '<p>La papelera está vacía.</p>';
                }
                 emptyMessage.classList.remove('hidden');
            }
        }
    });
}

    // --- FUNCIÓN PARA CARGAR QUIZZES ---
// --- FUNCIÓN PARA CARGAR QUIZZES (MODIFICADA CON LÓGICA DE BORRADORES) ---
    function cargarQuizzes(vista) {
        // Se eliminó la lógica de 'borradores'
        let url = (vista === 'activos') ? '/api/mis-quizzes' : '/api/mis-quizzes/papelera';

        if (pageTitle) pageTitle.textContent =
            (vista === 'activos') ? 'Mis Quizzes' : 'Papelera';

        if (emptyMessage) emptyMessage.innerHTML =
            (vista === 'activos') ? '<p>Aún no has creado ningún quiz.</p><p>Haz clic en "Nuevo Quiz" para empezar.</p>' :
            '<p>La papelera está vacía.</p>';

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Respuesta del servidor no fue exitosa.');
                return response.json();
            })
            .then(quizzes => {
                if (!quizContainer) return;
                quizContainer.innerHTML = '';
                if (quizzes.length === 0) {
                    emptyMessage?.classList.remove('hidden');
                } else {
                    emptyMessage?.classList.add('hidden');
                    quizzes.forEach(quiz => crearTarjetaQuiz(quiz, vista));
                }
            })
            .catch(error => {
                console.error(`Error al cargar quizzes:`, error);
                if (quizContainer) quizContainer.innerHTML = '<p style="color:red; text-align:center;">No se pudieron cargar los datos.</p>';
            });
    }

// --- FUNCIÓN PARA CREAR TARJETAS (MODIFICADA CON LÓGICA DE BORRADORES) ---
  function crearTarjetaQuiz(quiz, vista) {
    const quizCard = document.createElement('div');
    quizCard.className = 'repository-card';
    quizCard.id = `quiz-card-${quiz.id_cuestionario}`;
    // ===== INICIO MODIFICACIÓN: Lógica para la Imagen (CORREGIDA) =====
    let imageHTML = '';
    const imagenValida = quiz.imagen_portada &&
                         quiz.imagen_portada.trim() !== '' &&
                         quiz.imagen_portada !== 'null' &&
                         quiz.imagen_portada !== null;

    if (imagenValida) {
        // Escapar comillas en la URL para evitar problemas
        const urlSegura = quiz.imagen_portada.replace(/'/g, "\\'");
        imageHTML = `<div class="card-image" style="background-image: url('${urlSegura}'); background-size: cover; background-position: center;"></div>`;
    } else {
        // Usar un degradado como fallback en lugar de un placeholder
        imageHTML = `<div class="card-image-placeholder" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>`;
    }
    // ===== FIN MODIFICACIÓN =====

    // Define las opciones del menú según la vista (activos o papelera)
    let actionsHTML = '';
    if (vista === 'papelera') {
        actionsHTML = `<button class="menu-item btn-restore" data-id="${quiz.id_cuestionario}" data-titulo="${quiz.titulo}"><span>Restaurar</span></button>
                       <button class="menu-item btn-delete-permanent" data-id="${quiz.id_cuestionario}" data-titulo="${quiz.titulo}"><span>Eliminar</span></button>`;
    } else { // 'activos'
        // Generar un PIN temporal si pin_permanente es null para la URL 'Presentar'
        // Esto es solo un fallback, idealmente deberías generar/obtener el PIN al hacer clic si no existe
        const presentPin = quiz.pin_permanente || `temp_${quiz.id_cuestionario}`; // O simplemente el ID como antes
        actionsHTML = `<a href="/cuestionario/${quiz.id_cuestionario}/editar" class="menu-item"><span>Editar</span></a>
                       <a href="/sala_profesor?pin=${presentPin}" class="menu-item btn-presentar" data-id="${quiz.id_cuestionario}"><span>Presentar</span></a>
                       <button class="menu-item btn-trash" data-id="${quiz.id_cuestionario}" data-titulo="${quiz.titulo}"><span>Mover a Papelera</span></button>`;
    }

    // Estructura de la tarjeta - Reemplaza el div placeholder con imageHTML
    quizCard.innerHTML = `
        ${imageHTML}
        <div class="card-content">
            <div class="card-header">
                <h3 class="card-title">${quiz.titulo}</h3>
                <div class="card-menu-container">
                    <button class="menu-toggle-btn" aria-label="Opciones del quiz">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>
                    </button>
                    <div class="card-menu hidden">
                        ${actionsHTML}
                    </div>
                </div>
            </div>
            <p class="card-description">${quiz.numero_preguntas} Preguntas</p>
        </div>`;

    // Añadir listener para el botón "Presentar" si está en vista activa
    if (vista === 'activos') {
        const presentarBtn = quizCard.querySelector('.btn-presentar');
        if (presentarBtn) {
            presentarBtn.addEventListener('click', async (e) => {
                e.preventDefault(); // Prevenir navegación normal
                const cuestionarioId = presentarBtn.dataset.id;
                try {
                    const res = await fetch('/api/iniciar_sesion_clase', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id_cuestionario: cuestionarioId })
                    });
                    const data = await res.json();
                    if (data.success && data.pin) {
                        window.location.href = `/sala_profesor?pin=${encodeURIComponent(data.pin)}`; // Redirigir con el PIN obtenido
                    } else {
                        alert("Error al iniciar la sesión: " + (data.message || "Error desconocido"));
                    }
                } catch (err) {
                    console.error("Error al llamar a /api/iniciar_sesion_clase:", err);
                    alert("Error de conexión al intentar iniciar la sesión.");
                }
            });
        }
    }

    quizContainer.appendChild(quizCard);
}

    // --- FUNCIÓN PARA MOSTRAR MENSAJES (sin cambios) ---
    function mostrarMensaje(texto) {
        const container = document.getElementById('flash-message-container');
        if (!container) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flash-message';
        messageDiv.textContent = texto;
        container.appendChild(messageDiv);
        setTimeout(() => {
            messageDiv.style.transition = 'opacity 0.5s';
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 500);
        }, 3000);
    }

    // --- MANEJO DE EVENTOS (MODIFICADO) ---

    // 1. Cerrar menús al hacer clic fuera
    window.addEventListener('click', () => {
        // Cierra el menú del perfil si está abierto
        if (profileMenu && !profileMenu.classList.contains('hidden')) {
            profileMenu.classList.add('hidden');
        }
        // Cierra todos los menús de las tarjetas
        document.querySelectorAll('.card-menu').forEach(menu => menu.classList.add('hidden'));
    });

    // 2. Navegación lateral
    sideNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            sideNavLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            cargarQuizzes(this.dataset.view);
        });
    });

    // 3. Clics en los botones de las tarjetas y menús
    if (quizContainer) {
        quizContainer.addEventListener('click', function(e) {
            // Detener la propagación para que el window.click no interfiera
            e.stopPropagation();

            const menuButton = e.target.closest('.menu-toggle-btn');
            const actionButton = e.target.closest('.btn-trash, .btn-restore, .btn-delete-permanent');

            // Lógica para abrir/cerrar el menú de la tarjeta
            if (menuButton) {
                const menu = menuButton.nextElementSibling;
                const isCurrentlyVisible = !menu.classList.contains('hidden');

                // Primero, oculta todos los demás menús abiertos
                document.querySelectorAll('.card-menu').forEach(m => m.classList.add('hidden'));

                // Si el menú no estaba visible, muéstralo
                if (!isCurrentlyVisible) {
                    menu.classList.remove('hidden');
                }
                return; // Salimos para no procesar otros clics
            }

            // Lógica para las acciones dentro del menú
            if (actionButton) {
                const quizId = actionButton.dataset.id;
                const quizTitulo = actionButton.dataset.titulo;

                if (actionButton.classList.contains('btn-trash')) {
                    if (modalTitle) modalTitle.textContent = `Mover "${quizTitulo}" a la papelera`;
                    if (confirmTrashBtn) confirmTrashBtn.dataset.quizIdToDelete = quizId;
                    if (modal) modal.classList.remove('hidden');
                } else if (actionButton.classList.contains('btn-restore')) {
                    fetch(`/api/cuestionario/${quizId}/restaurar`, { method: 'POST' }).then(res => res.json()).then(data => { if (data.success) { document.getElementById(`quiz-card-${quizId}`)?.remove(); mostrarMensaje(`Se ha restaurado "${quizTitulo}".`); if (quizContainer.children.length === 0) emptyMessage?.classList.remove('hidden'); }});
                } else if (actionButton.classList.contains('btn-delete-permanent')) {
                    if (confirm(`¿Seguro que quieres eliminar "${quizTitulo}" para siempre?`)) {
                        fetch(`/api/cuestionario/${quizId}/eliminar-permanente`, { method: 'DELETE' }).then(res => res.json()).then(data => { if (data.success) { document.getElementById(`quiz-card-${quizId}`)?.remove(); mostrarMensaje(`Se ha eliminado "${quizTitulo}".`); if (quizContainer.children.length === 0) emptyMessage?.classList.remove('hidden'); }});
                    }
                }
                 // Ocultar todos los menús después de una acción
                document.querySelectorAll('.card-menu').forEach(m => m.classList.add('hidden'));
            }
        });
    }

    // 4. Botones del Modal
   if (confirmTrashBtn) {
    confirmTrashBtn.addEventListener('click', function() {
        const quizId = this.dataset.quizIdToDelete;

        // --- CAMBIO 1: Mostrar estado de carga ---
        // Deshabilitamos los botones para evitar doble clic
        this.disabled = true;
        this.textContent = 'Moviendo...'; // <-- Feedback visual
        if (cancelTrashBtn) cancelTrashBtn.disabled = true;

        // NO ocultamos el modal todavía
        // if (modal) modal.style.display = 'none'; // <-- ESTA LÍNEA SE MUEVE AL FINAL

        fetch(`/api/cuestionario/${quizId}/mover-a-papelera`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // --- CAMBIO 2: Éxito ---
                    // Solo removemos la tarjeta manualmente (es más rápido)
                    document.getElementById(`quiz-card-${quizId}`)?.remove();
                    mostrarMensaje(data.message);

                    // --- CAMBIO 3: ELIMINAMOS LA RECARGA INNECESARIA ---
                    // const activeLink = document.querySelector('.side-nav-link.active');
                    // if (activeLink) {
                    //     cargarQuizzes(activeLink.dataset.view); // <-- ELIMINADO
                    // }

                    // Verificamos si la lista quedó vacía
                    if (quizContainer && quizContainer.children.length === 0) {
                        emptyMessage?.classList.remove('hidden');
                    }

                } else {
                    // Error manejado por el backend
                    mostrarMensaje(`Error: ${data.message}`);
                }
            })
            .catch(error => {
                // Error de red
                console.error("Error en la solicitud de mover a papelera:", error);
                mostrarMensaje("Error de conexión al servidor al mover el quiz.");
            })
            .finally(() => {
                // --- CAMBIO 4: ESTO SE EJECUTA SIEMPRE ---
                // Se ejecuta después del .then() o .catch()

                // 1. Restauramos los botones
                this.disabled = false;
                this.textContent = 'Mover a la papelera';
                if (cancelTrashBtn) cancelTrashBtn.disabled = false;

                // 2. AHORA SÍ ocultamos el modal
               if (modal) modal.classList.add('hidden');
            });
    });
}

if (cancelTrashBtn && modal) {
    cancelTrashBtn.addEventListener('click', function() {
        modal.classList.add('hidden'); // <-- También oculta al cancelar
    });
}

    // --- CARGA INICIAL ---
    if (quizContainer) {
        cargarQuizzes('activos');
    } else {
        console.error("No se encontró el 'quiz-list-container'. La carga automática no se puede iniciar.");
    }



});