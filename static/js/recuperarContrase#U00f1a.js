document.addEventListener('DOMContentLoaded', function() {
    const recoverForm = document.getElementById('recoverForm');
    const emailInput = document.getElementById('email');

    recoverForm.addEventListener('submit', function(e) {
        if (!validateEmail()) {
            e.preventDefault();
        }
    });

    function validateEmail() {
        let isValid = true;
        removeError(emailInput);
        const emailValue = emailInput.value.trim();

        if (emailValue === '') {
            addError(emailInput, 'El correo es obligatorio.');
            isValid = false;
        } else if (!emailValue.endsWith('@usat.pe')) {
            addError(emailInput, 'Solo se permiten correos con dominio @usat.pe');
            isValid = false;
        }
        
        return isValid;
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