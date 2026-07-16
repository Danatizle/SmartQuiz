// 🔥 FUNCIONES GLOBALES (FUERA del DOMContentLoaded)
window.cerrarModalPreview = function() {
    const modal = document.getElementById('modalPreview');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.toggleRespuestas = function(element) {
    const container = element.parentElement.querySelector('.respuestas-container');
    const icono = element.querySelector('.icono-flecha');

    if (container) {
        const estaAbierto = container.style.display === 'block';
        container.style.display = estaAbierto ? 'none' : 'block';

        if (icono) {
            icono.style.transform = estaAbierto ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
};

// 🔥 TODO EL CÓDIGO DENTRO DE UN SOLO DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA PARA EL MENÚ DESPLEGABLE DEL PERFIL ---
    const avatarButton = document.getElementById('avatar-button');
    const profileMenu = document.getElementById('profile-menu');

    if (avatarButton && profileMenu) {
        avatarButton.addEventListener('click', (event) => {
            event.stopPropagation();
            profileMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (event) => {
            if (!profileMenu.contains(event.target) && !avatarButton.contains(event.target)) {
                profileMenu.classList.add('hidden');
            }
        });
    }

    // --- LÓGICA PARA LA PÁGINA DE EXPLORAR QUIZZES ---
    const quizGrid = document.querySelector('.quiz-grid-explore');
    if (quizGrid) {
        quizGrid.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-action');
            if (!button) return;

            if (button.classList.contains('btn-duplicate')) {
                handleDuplicateClick(button);
            }

            if (button.classList.contains('btn-preview')) {
                handlePreviewClick(button);
            }
        });
    }

    // --- FUNCIÓN PARA PREVISUALIZAR (MODAL) ---
    function handlePreviewClick(button) {
        const quizCard = button.closest('.quiz-card-explore');
        const quizId = quizCard.querySelector('.btn-duplicate').dataset.quizId;
        const quizTitulo = quizCard.querySelector('h4').textContent;

        abrirModalPreview(quizId, quizTitulo);
    }

    function abrirModalPreview(idQuiz, titulo) {
    if (!document.getElementById('modalPreview')) {
        crearModalHTML();
    }

    // 🔥 CAMBIO AQUÍ: Usar la ruta pública
    fetch(`/api/cuestionario/publico/${idQuiz}`)
        .then(r => {
            console.log('Status:', r.status);
            if (!r.ok) {
                throw new Error(`HTTP ${r.status}`);
            }
            return r.json();
        })
        .then(quiz => {
            console.log('📦 Datos recibidos:', quiz);
            console.log('📋 Preguntas:', quiz.preguntas);

            document.getElementById('modalTitulo').textContent = quiz.titulo || 'Sin título';
            const total = quiz.preguntas ? quiz.preguntas.length : 0;
            document.getElementById('modalConteo').textContent = `${total} preguntas`;

            let html = '';
            if (quiz.preguntas && quiz.preguntas.length > 0) {
                quiz.preguntas.forEach((p, i) => {
                    const textoPregunta = p.texto_pregunta || p.texto || 'Sin texto';
                    console.log(`Pregunta ${i+1}:`, p);

                    html += `
                        <div style="margin-bottom:15px; padding:15px; background:#f8f9fa; border-radius:6px; border-left:4px solid #6c63ff;">
                            <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="window.toggleRespuestas(this)">
                                <div>
                                    <span style="display:inline-block; background:#6c63ff; color:white; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold;">Pregunta ${i+1}</span>
                                    <p style="margin:10px 0 0 0; color:#333; font-weight:500; font-size:15px;">${textoPregunta}</p>
                                    ${p.url_media ? `<img src="${p.url_media}" style="margin-top:10px; max-width:100%; border-radius:6px; max-height:120px;">` : ''}
                                </div>
                                <svg style="width:24px; height:24px; transition:transform 0.3s; color:#6c63ff;" class="icono-flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                            <div class="respuestas-container" style="display:none; margin-top:15px; padding-top:10px; border-top:1px solid #dee2e6;">
                                ${p.respuestas ? p.respuestas.map((r, idx) => `
                                    <div style="padding:10px; margin:5px 0; background:white; border-radius:6px; border-left:3px solid ${r.es_correcta ? '#27ae60' : '#95a5a6'}; display:flex; align-items:center; gap:10px;">
                                        <span style="background:${r.es_correcta ? '#27ae60' : '#95a5a6'}; color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${String.fromCharCode(65 + idx)}</span>
                                        <span style="color:${r.es_correcta ? '#27ae60' : '#333'}; flex:1;">${r.texto_respuesta}</span>
                                        ${r.es_correcta ? '<span style="color:#27ae60; font-weight:bold;">✓ Correcta</span>' : ''}
                                    </div>
                                `).join('') : '<p style="color:#999; padding:10px;">Sin respuestas disponibles</p>'}
                            </div>
                        </div>
                    `;
                });
            } else {
                html = '<p style="color:#999; text-align:center; padding:40px;">Sin preguntas disponibles</p>';
            }

            document.getElementById('modalPreguntas').innerHTML = html;
            document.getElementById('modalPreview').style.display = 'flex';
        })
        .catch(e => {
            console.error('❌ Error completo:', e);
            alert('No se pudo cargar el quiz. Puede que sea privado o haya un error de conexión.');
        });
}

    function crearModalHTML() {
        const modal = document.createElement('div');
        modal.id = 'modalPreview';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; justify-content:center; align-items:center; padding:20px; overflow-y:auto;';

        modal.innerHTML = `
            <div style="background:white; border-radius:12px; max-width:700px; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3); width:100%;">
                <div style="background: linear-gradient(135deg, #6c63ff 0%, #5a52d5 100%); color:white; padding:30px; border-radius:12px 12px 0 0; display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <p style="margin:0; font-size:12px; opacity:0.9;">Quiz</p>
                        <h2 id="modalTitulo" style="margin:10px 0 0 0; font-size:28px; line-height:1.3;"></h2>
                        <p id="modalConteo" style="margin:15px 0 0 0; font-size:14px; opacity:0.9;"></p>
                    </div>
                    <button onclick="window.cerrarModalPreview()" style="background:none; border:none; font-size:32px; cursor:pointer; color:white; padding:0; margin:0;">✕</button>
                </div>
                <div id="modalPreguntas" style="padding:30px;"></div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target.id === 'modalPreview') window.cerrarModalPreview();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.cerrarModalPreview();
    });

    async function handleDuplicateClick(button) {
        const quizId = button.dataset.quizId;
        const quizTitle = button.dataset.quizTitulo;

        const isConfirmed = confirm(`¿Estás seguro de que quieres duplicar el quiz "${quizTitle}"?\n\nSe creará una copia editable en tu sección de "Mis Quizzes".`);

        if (isConfirmed) {
            await duplicateQuiz(quizId, button);
        }
    }

    async function duplicateQuiz(quizId, button) {
        button.disabled = true;
        button.textContent = 'Duplicando...';

        try {
            const response = await fetch(`/api/quiz/duplicar/${quizId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert(result.message);
                window.location.href = '/inicioProfesores';
            } else {
                alert(result.message || 'No se pudo duplicar el quiz.');
            }

        } catch (error) {
            console.error('Error de red al intentar duplicar:', error);
            alert('Hubo un problema de conexión. Inténtalo de nuevo.');
        } finally {
            button.disabled = false;
            button.textContent = 'Duplicar';
        }
    }

    // Filtro de búsqueda en tiempo real
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const filterText = searchInput.value.toLowerCase().trim();
            const quizCards = document.querySelectorAll('.quiz-card-explore');

            quizCards.forEach(card => {
                const title = card.dataset.title || '';
                if (title.includes(filterText)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

}); // ← FIN del DOMContentLoaded (UN SOLO CIERRE)