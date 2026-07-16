/* static/js/explorarQuizzesAlumno.js */

document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA PARA EL MENÚ DESPLEGABLE DEL PERFIL ---
    // Asume que tu header completo tiene estos IDs (basado en el CSS)
    const avatarButton = document.getElementById('avatar-button');
    const profileMenu = document.getElementById('profile-menu');

    if (avatarButton && profileMenu) {
        avatarButton.addEventListener('click', (event) => {
            // Evita que el click en el documento cierre el menú inmediatamente
            event.stopPropagation();
            profileMenu.classList.toggle('hidden');
        });

        // Cierra el menú si se hace clic fuera de él
        document.addEventListener('click', (event) => {
            if (profileMenu && !profileMenu.contains(event.target) && !avatarButton.contains(event.target)) {
                profileMenu.classList.add('hidden');
            }
        });
    }

    // --- LÓGICA PARA EL FILTRO DE BÚSQUEDA ---
    const searchInput = document.getElementById('search-input');
    const quizGrid = document.querySelector('.quiz-grid-explore');

    if (searchInput && quizGrid) {
        
        searchInput.addEventListener('input', () => {
            const filterText = searchInput.value.toLowerCase().trim();
            const quizCards = quizGrid.querySelectorAll('.quiz-card-explore');
            
            // Nota: No manejamos un mensaje de "no hay resultados de filtro"
            // para no interferir con el mensaje original de "No hay quizzes" de Jinja.
            // Simplemente ocultamos las tarjetas que no coinciden.

            quizCards.forEach(card => {
                const title = card.dataset.title || ''; // Obtiene el título de data-title
                
                if (title.includes(filterText)) {
                    card.style.display = 'flex'; // 'flex' porque la tarjeta usa flexbox
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

}); // Fin de DOMContentLoaded