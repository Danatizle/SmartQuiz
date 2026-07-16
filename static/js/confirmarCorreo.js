document.addEventListener('DOMContentLoaded', function() {
    const confirmForm = document.getElementById('confirmForm');
    const codigoInput = document.getElementById('codigo');

    // --- LÓGICA DE VALIDACIÓN DEL FORMULARIO (Tu código) ---
    if (confirmForm) {
        confirmForm.addEventListener('submit', function(e) {
            if (!validateForm()) {
                e.preventDefault(); // Detiene el envío si la validación falla
            }
        });
    }

    function validateForm() {
        let isValid = true;
        removeError(codigoInput);

        const codigoValue = codigoInput.value.trim();

        if (codigoValue === '') {
            addError(codigoInput, 'El código es obligatorio.');
            isValid = false;
        } else if (!/^\d{6}$/.test(codigoValue)) {
            addError(codigoInput, 'El código debe tener 6 dígitos numéricos.');
            isValid = false;
        }

        return isValid;
    }

    // --- LÓGICA PARA REENVIAR CÓDIGO (El código que faltaba) ---
    const resendLink = document.getElementById('reenviar-codigo-link');
    const emailInput = document.getElementById('email-hidden-input');
    const messageSpan = document.getElementById('reenviar-mensaje');

    if (resendLink) {
        resendLink.addEventListener('click', function(e) {
            e.preventDefault(); // Evita que el enlace recargue la página

            const email = emailInput.value;
            if (!email) {
                alert('No se pudo encontrar el email para reenviar el código.');
                return;
            }

            // Muestra un mensaje de "cargando"
            resendLink.style.display = 'none';
            messageSpan.textContent = 'Enviando nuevo código...';
            messageSpan.style.color = '#6b7280'; // Color gris
            messageSpan.style.display = 'inline';

            // Llama a la nueva ruta en el backend
            fetch('/reenviar-codigo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email }) // Envía el email al servidor
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    messageSpan.textContent = '¡Código reenviado! Revisa tu correo.';
                    messageSpan.style.color = '#10b981'; // Color verde
                } else {
                    messageSpan.textContent = data.error || 'Error al reenviar el código.';
                    messageSpan.style.color = '#ef4444'; // Color rojo
                    resendLink.style.display = 'inline'; // Muestra el enlace de nuevo para reintentar
                }
            })
            .catch(error => {
                console.error('Error:', error);
                messageSpan.textContent = 'Error de red. Intenta de nuevo.';
                messageSpan.style.color = '#ef4444'; // Color rojo
                resendLink.style.display = 'inline';
            });
        });
    }


    // --- Funciones de Ayuda para Errores (Tu código) ---
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