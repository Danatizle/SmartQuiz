// Manejo del formulario de registro
document.addEventListener('DOMContentLoaded', function () {
    const registroForm = document.getElementById('registroForm');
    const apellidosInput = document.getElementById('apellidos');
    const nombresInput = document.getElementById('nombres');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const termsCheckbox = document.getElementById('terms');
    const submitButton = registroForm.querySelector('.submit-btn');

    // Toggle password visibility
    const togglePassword = document.getElementById('toggle-password');
    const toggleConfirmPassword = document.getElementById('toggle-confirm-password');

    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            togglePasswordVisibility(passwordInput, this);
        });
    }

    if (toggleConfirmPassword) {
        toggleConfirmPassword.addEventListener('click', function () {
            togglePasswordVisibility(confirmPasswordInput, this);
        });
    }

    function togglePasswordVisibility(input, button) {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        button.textContent = type === 'password' ? '👁️' : '🙈';
    }

    // Password strength checker
    if (passwordInput) {
        passwordInput.addEventListener('input', function () {
            checkPasswordStrength(this.value);
        });
    }

    function checkPasswordStrength(password) {
        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');

        if (!strengthBar || !strengthText) return;

        let strength = 0;
        let text = '';
        let color = '';

        if (password.length === 0) {
            strengthBar.style.width = '0%';
            strengthText.textContent = '';
            return;
        }

        // Criteria
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 10;
        if (/[a-z]/.test(password)) strength += 15;
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 20;

        // Set text and color
        if (strength < 40) {
            text = 'Débil';
            color = '#ef4444';
        } else if (strength < 70) {
            text = 'Media';
            color = '#f59e0b';
        } else {
            text = 'Fuerte';
            color = '#10b981';
        }

        strengthBar.style.width = strength + '%';
        strengthBar.style.backgroundColor = color;
        strengthText.textContent = text;
        strengthText.style.color = color;
    }

    // Validación en tiempo real
    if (apellidosInput) {
        apellidosInput.addEventListener('blur', function () {
            validateTextField(this, 'Los apellidos son obligatorios');
        });
    }

    if (nombresInput) {
        nombresInput.addEventListener('blur', function () {
            validateTextField(this, 'Los nombres son obligatorios');
        });
    }

    if (usernameInput) {
        usernameInput.addEventListener('blur', function () {
            validateUsername(this);
        });
    }

    if (emailInput) {
        emailInput.addEventListener('blur', function () {
            validateEmail(this);
        });
        // Validar también al escribir para borrar el error
        emailInput.addEventListener('input', function () {
             if (this.classList.contains('error')) {
                 validateEmail(this);
             }
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('blur', function () {
            validatePasswordMatch();
        });

        confirmPasswordInput.addEventListener('input', function () {
            if (this.classList.contains('error')) {
                validatePasswordMatch();
            }
        });
    }

    // Validación del formulario al enviar
    if (registroForm) {
        registroForm.addEventListener('submit', function (e) {
            let isValid = true;

            // Validar todos los campos
            if (!validateTextField(apellidosInput, 'Los apellidos son obligatorios')) isValid = false;
            if (!validateTextField(nombresInput, 'Los nombres son obligatorios')) isValid = false;
            if (!validateUsername(usernameInput)) isValid = false;
            if (!validateEmail(emailInput)) isValid = false; // Ya incluye la validación de dominio
            if (!validatePassword(passwordInput)) isValid = false;
            if (!validatePasswordMatch()) isValid = false;
            if (!validateTerms()) isValid = false;

            if (!isValid) {
                e.preventDefault();
                showError('Por favor, corrige los errores antes de continuar.');
            } else {
                submitButton.disabled = true;
                submitButton.textContent = 'Registrando...';
            }
        });
    }

    // Funciones de validación
    function validateTextField(input, errorMessage) {
        const value = input.value.trim();
        removeError(input);

        if (value === '') {
            addError(input, errorMessage);
            return false;
        }

        if (value.length < 2) {
            addError(input, 'Debe tener al menos 2 caracteres');
            return false;
        }

        return true;
    }

    function validateUsername(input) {
        const value = input.value.trim();
        removeError(input);

        if (value === '') {
            addError(input, 'El nombre de usuario es obligatorio');
            return false;
        }

        if (value.length < 3) {
            addError(input, 'Debe tener al menos 3 caracteres');
            return false;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            addError(input, 'Solo letras, números y guión bajo');
            return false;
        }

        return true;
    }

    function validateEmail(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const value = input.value.trim();

        removeError(input);

        if (value === '') {
            addError(input, 'El email es obligatorio');
            return false;
        }

        if (!emailRegex.test(value)) {
            addError(input, 'Por favor, ingresa un email válido');
            return false;
        }

        if (!value.endsWith('@usat.edu.pe') && !value.endsWith('@usat.pe')) {
            addError(input, 'El dominio debe ser @usat.edu.pe o @usat.pe');
            return false;
        }

        return true;
    }

    function validatePassword(input) {
        const value = input.value;
        removeError(input);

        if (value === '') {
            addError(input, 'La contraseña es obligatoria');
            return false;
        }

        if (value.length < 8) {
            addError(input, 'Debe tener al menos 8 caracteres');
            return false;
        }

        return true;
    }

    function validatePasswordMatch() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        removeError(confirmPasswordInput);

        if (confirmPassword === '') {
            addError(confirmPasswordInput, 'Debes confirmar tu contraseña');
            return false;
        }

        if (password !== confirmPassword) {
            addError(confirmPasswordInput, 'Las contraseñas no coinciden');
            return false;
        }

        return true;
    }

    function validateTerms() {
        if (termsCheckbox && !termsCheckbox.checked) { // Verifica si termsCheckbox existe
            showError('Debes aceptar los términos y condiciones');
            return false;
        }
        return true;
    }

    // Funciones auxiliares
    function addError(input, message) {
        input.classList.add('error');
        let errorMsg = input.parentElement.querySelector('.error-message');
        if (!errorMsg) {
            errorMsg = document.createElement('span');
            errorMsg.className = 'error-message';
            // Inserta el mensaje después del input, no dentro del parentElement directamente
            input.parentNode.insertBefore(errorMsg, input.nextSibling);
        }
        errorMsg.textContent = message;
    }

    function removeError(input) {
        input.classList.remove('error');
        const errorMsg = input.parentElement.querySelector('.error-message');
        if (errorMsg) {
            errorMsg.remove();
        }
    }

    function showError(message) {
        let flashContainer = document.querySelector('.flash-message.danger');
        if (!flashContainer) {
            flashContainer = document.createElement('div');
            flashContainer.className = 'flash-message danger'; // Asegúrate que tu CSS tenga estilos para .flash-message.danger
            const formContainer = document.querySelector('.form-container'); // Asegúrate que este selector exista
            if (formContainer) {
                 const form = formContainer.querySelector('form');
                 formContainer.insertBefore(flashContainer, form);
            } else {
                 // Si no hay .form-container, inserta al principio del body o en otro lugar visible
                 document.body.insertBefore(flashContainer, document.body.firstChild);
            }
        }
        flashContainer.textContent = message;
        setTimeout(() => {
            flashContainer.style.opacity = '0';
            setTimeout(() => {
                flashContainer.remove();
            }, 300);
        }, 5000);
    }

    // Modal de términos y condiciones
    const modal = document.getElementById('terms-modal');
    const termsLink = document.getElementById('terms-link');
    const modalClose = document.querySelector('.modal-close');
    const modalAccept = document.querySelector('.modal-accept');

    if (termsLink && modal) {
        termsLink.addEventListener('click', function (e) {
            e.preventDefault();
            modal.style.display = 'block';
        });
    }

    if (modalClose && modal) {
        modalClose.addEventListener('click', function () {
            modal.style.display = 'none';
        });
    }

    if (modalAccept && modal && termsCheckbox) {
        modalAccept.addEventListener('click', function () {
            termsCheckbox.checked = true;
            modal.style.display = 'none';
        });
    }

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function (e) {
        if (modal && e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Cerrar flash messages al hacer clic
    // (Asegúrate que los mensajes flash generados por Flask también tengan la clase .flash-message)
    document.body.addEventListener('click', function(e) {
        if (e.target.classList.contains('flash-message')) {
            e.target.style.opacity = '0';
            setTimeout(() => {
                e.target.remove();
            }, 300);
        }
    });
});