document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('changePasswordForm');
    const codigoInput = document.getElementById('codigo');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');

    form.addEventListener('submit', function(e) {
        if (!validateForm()) {
            e.preventDefault();
        }
    });

    function validateForm() {
        let isValid = true;
        // Limpiar errores previos
        removeError(codigoInput);
        removeError(passwordInput);
        removeError(confirmPasswordInput);

        // 1. Validar código
        const codigoValue = codigoInput.value.trim();
        if (codigoValue === '') {
            addError(codigoInput, 'El código es obligatorio.');
            isValid = false;
        } else if (!/^\d{6}$/.test(codigoValue)) {
            addError(codigoInput, 'El código debe tener 6 dígitos.');
            isValid = false;
        }

        // 2. Validar contraseña
        const passwordValue = passwordInput.value;
        if (passwordValue.length < 8) {
            addError(passwordInput, 'La contraseña debe tener al menos 8 caracteres.');
            isValid = false;
        }

        // 3. Validar confirmación de contraseña
        const confirmPasswordValue = confirmPasswordInput.value;
        if (confirmPasswordValue !== passwordValue) {
            addError(confirmPasswordInput, 'Las contraseñas no coinciden.');
            isValid = false;
        }

        return isValid;
    }

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

    // --- Funciones de Ayuda para Errores ---
    function addError(input, message) {
        input.classList.add('error');
        let errorMsg = input.parentElement.querySelector('.error-message');
        if (!errorMsg) {
            errorMsg = document.createElement('span');
            errorMsg.className = 'error-message';
            input.parentElement.appendChild(errorMsg);
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
});