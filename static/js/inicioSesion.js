// Manejo del formulario de inicio de sesión
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('form');
    const usernameOrEmailInput = document.getElementById('username_or_email');  // CORREGIDO: Usar el ID correcto
    const passwordInput = document.getElementById('password');
    const submitButton = loginForm.querySelector('button[type="submit"]');

    // Validación en tiempo real del username/email
    if (usernameOrEmailInput) {
        usernameOrEmailInput.addEventListener('blur', function() {
            validateUsernameOrEmail(this);
        });

        usernameOrEmailInput.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateUsernameOrEmail(this);
            }
        });
    }

    // Validación en tiempo real de la contraseña
    if (passwordInput) {
        passwordInput.addEventListener('blur', function() {
            validatePassword(this);
        });

        passwordInput.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validatePassword(this);
            }
        });
    }

    // Validación del formulario antes de enviar
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            let isValid = true;

            // Validar username/email
            if (!validateUsernameOrEmail(usernameOrEmailInput)) {
                isValid = false;
            }

            // Validar contraseña
            if (!validatePassword(passwordInput)) {
                isValid = false;
            }

            // Si hay errores, prevenir el envío
            if (!isValid) {
                e.preventDefault();
                showError('Por favor, corrige los errores antes de continuar.');
            } else {
                // Deshabilitar el botón para evitar envíos múltiples
                submitButton.disabled = true;
                submitButton.textContent = 'Iniciando sesión...';
            }
        });
    }

    // Función para validar username o email
    function validateUsernameOrEmail(input) {
        const value = input.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        removeError(input);

        if (value === '') {
            addError(input, 'El email o nombre de usuario es obligatorio');
            return false;
        }

        // Si contiene "@", validar como email
        if (value.includes('@')) {
            if (!emailRegex.test(value)) {
                addError(input, 'Por favor, ingresa un email válido');
                return false;
            }
        }
        // Si no contiene "@", es username: solo verificar que no esté vacío (ya hecho arriba)

        return true;
    }

    // Función para validar contraseña
    function validatePassword(input) {
        const value = input.value;

        removeError(input);

        if (value === '') {
            addError(input, 'La contraseña es obligatoria');
            return false;
        }

        if (value.length < 8) {
            addError(input, 'La contraseña debe tener al menos 8 caracteres');
            return false;
        }

        return true;
    }

    // Función para agregar error visual
    function addError(input, message) {
        input.classList.add('error');

        // Buscar si ya existe un mensaje de error
        let errorMsg = input.parentElement.querySelector('.error-message');

        if (!errorMsg) {
            errorMsg = document.createElement('span');
            errorMsg.className = 'error-message';
            input.parentElement.appendChild(errorMsg);
        }

        errorMsg.textContent = message;
    }

    // Función para remover error visual
    function removeError(input) {
        input.classList.remove('error');
        const errorMsg = input.parentElement.querySelector('.error-message');
        if (errorMsg) {
            errorMsg.remove();
        }
    }

    // Función para mostrar mensaje de error general
    function showError(message) {
        // Buscar si ya existe un contenedor de mensajes flash
        let flashContainer = document.querySelector('.flash-message.danger');

        if (!flashContainer) {
            flashContainer = document.createElement('div');
            flashContainer.className = 'flash-message danger';

            // Insertar antes del formulario
            const formContainer = document.querySelector('.login-container');
            const form = formContainer.querySelector('form');
            formContainer.insertBefore(flashContainer, form);
        }

        flashContainer.textContent = message;

        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            flashContainer.style.opacity = '0';
            setTimeout(() => {
                flashContainer.remove();
            }, 300);
        }, 5000);
    }

    // Cerrar mensajes flash al hacer click
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(msg => {
        msg.style.cursor = 'pointer';
        msg.addEventListener('click', function() {
            this.style.opacity = '0';
            setTimeout(() => {
                this.remove();
            }, 300);
        });
    });

    // Mostrar/ocultar contraseña (si agregas un botón toggle)
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Cambiar icono o texto del botón
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }
});

// Agregar estilos CSS para los estados de error
const style = document.createElement('style');
style.textContent = `
    input.error {
        border-color: #dc2626 !important;
        background-color: #fee2e2;
    }

    .error-message {
        display: block;
        color: #dc2626;
        font-size: 0.75rem;
        margin-top: 0.25rem;
        font-weight: 500;
    }

    .flash-message {
        transition: opacity 0.3s ease;
    }
`;
document.head.appendChild(style);