document.addEventListener('DOMContentLoaded', () => {
    const avatarButton = document.getElementById('avatar-button');
    const profileMenu = document.getElementById('profile-menu');
    const joinGameButton = document.querySelector('.btn-join-game');

    // --- Lógica para el menú desplegable del perfil ---
    if (avatarButton && profileMenu) {
        avatarButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Evita que el clic se propague al documento
            profileMenu.classList.toggle('hidden');
        });

        // Cierra el menú si se hace clic fuera de él
        document.addEventListener('click', (event) => {
            if (!profileMenu.contains(event.target) && !avatarButton.contains(event.target)) {
                profileMenu.classList.add('hidden');
            }
        });
    }


});
