document.addEventListener('DOMContentLoaded', function() {
    console.log('Script de Mi Perfil cargado correctamente.');

    // --- LÓGICA PARA EL MENÚ DESPLEGABLE DEL PERFIL ---
    const avatarButton = document.getElementById('avatar-button');
    const profileMenu = document.getElementById('profile-menu');

    if (avatarButton && profileMenu) {
        avatarButton.addEventListener('click', function(event) {
            event.stopPropagation();
            profileMenu.classList.toggle('hidden');
        });
        profileMenu.addEventListener('click', function(event) {
            event.stopPropagation();
        });
        window.addEventListener('click', function(event) {
            if (profileMenu && !profileMenu.classList.contains('hidden')) {
                profileMenu.classList.add('hidden');
            }
        });
    }

    // --- LÓGICA PARA MOSTRAR/OCULTAR CONTRASEÑA ---
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const passwordInput = document.getElementById('password');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function() {
            // Este campo está deshabilitado, así que esta lógica es solo visual
            // Si en el futuro lo habilitas para cambiar contraseña,
            // esta lógica funcionará.
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            this.style.opacity = (type === 'password') ? '1' : '0.5';
        });
    }

    // --- LÓGICA FORMULARIOS (Simulada) ---
    // (El botón "Guardar Cambios" ya no existe, ahora es un enlace)
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Funcionalidad para cambiar contraseña no implementada.');
        });
    }
});