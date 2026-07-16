#--app
from datetime import timedelta
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, abort, session
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask import send_file
from conexionBD import obtener_conexion

import logging
import random
import string
import secrets
import hashlib
from flask_mail import Mail, Message

import os
from werkzeug.utils import secure_filename
from threading import Event
partida_events = {}

# --- Carga de variables de entorno desde .env (solo en local) ---
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # En producción (PythonAnywhere) las variables se definen en el WSGI.
    pass

# --- IMPORTACION  PARA CREAR CUESTIONARIOS POR MEDIO DE UN EXCEL ---
import controladorExcel
from flask import send_from_directory

# -----------------------------------------------------

# --- IMPORTACIÓN DE CONTROLADORES ---
import controladorUsuario as controlador_user
import controladorCuestionario as controlador_cuestionario
import controladorActividadAlumno as controlador_actividad
import controladorExplorarProfesor as controlador_explorar_profesor
import controladorSalaEsperaProfesor as controlador_sala
import controladorSalaEsperaAlumno as controlador_sala_alumno
import controladorPartida as controlador_partida
import controladorPreguntas as controlador_pregunta
import controladorRespuestaParticipante
import controladorRespuesta
from flask import json




# --- Configuración Inicial ---
app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)


# # --- CONFIGURACIÓN DE LA APLICACIÓN ANTIGUA ---
# app.config['SECRET_KEY'] = 'una-clave-muy-secreta-y-dificil-de-adivinar'
# app.config['SESSION_PERMANENT'] = False

# --- CONFIGURACIÓN DE LA APLICACIÓN NUEVA ---
# La SECRET_KEY se lee desde el entorno; el valor por defecto es solo para desarrollo local.
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'clave-solo-para-desarrollo-local')

# ✅ CONFIGURACIÓN DE SESIONES MEJORADA
app.config['SESSION_PERMANENT'] = True  # ← Cambiar a True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # ← La sesión dura 7 días
app.config['SESSION_REFRESH_EACH_REQUEST'] = True  # ← Renueva con cada request



# --- CONFIGURACIÓN DE CORREO (GMAIL) ---
app.config['MAIL_SERVER'] = 'smtp.googlemail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')       # Correo de Gmail (desde .env)
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')       # Contraseña de aplicación (desde .env)
app.config['MAIL_DEFAULT_SENDER'] = ('Smartquiz', os.environ.get('MAIL_USERNAME'))  # Nombre que verá el usuario

# --- Inicialización de Extensiones ---
login_manager = LoginManager(app)
mail = Mail(app) # <-- Inicializamos Mail
login_manager.login_view = 'login'
login_manager.login_message = "Por favor, inicia sesión para acceder a esta página."
login_manager.login_message_category = "info"




# --- Cabeceras para mejorar concurrencia/latencia en PythonAnywhere ---
from flask import make_response

@app.after_request
def add_perf_headers(response):
    """
    Evita caché agresiva del proxy/CDN y cierra conexiones o desactiva buffering
    en endpoints de juego para no acumular sockets.
    """
    # No cache para TODAS las respuestas
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'

    # Endpoints “calientes” del juego: estado/polling y responder
    path = request.path or ""
    if path.startswith('/api/juego/'):
        # Hace que el proxy no “buferice” la respuesta (estilo Nginx)
        response.headers['X-Accel-Buffering'] = 'no'
        # Cierra la conexión tras la respuesta para liberar el worker rápido
        response.headers['Connection'] = 'close'
        # Opcional: deshabilita compresión si la tuvieras activada a nivel proxy
        response.headers['Content-Encoding'] = 'identity'
    return response

# (Opcional) Evitar que Flask “minifique”/ordene el JSON (micro mejora)
app.config['JSON_SORT_KEYS'] = False

# (Opcional) Evita caché agresiva de archivos estáticos durante desarrollo
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0




# --- CONFIGURACIÓN DE SUBIDAS ---
UPLOAD_FOLDER = os.path.join(app.static_folder, 'uploads', 'images')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Asegúrate de que la carpeta exista
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Función auxiliar para verificar extensiones
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
# --- FIN CONFIGURACIÓN DE SUBIDAS ---

# --- Modelo de Usuario para Flask-Login ---
# --- Modelo de Usuario para Flask-Login (MODIFICADO) ---
class User(UserMixin):
    # Añadimos nombres y apellidos por separado
    def __init__(self, id, username, email, rol, nombres, apellidos, is_verified=False):
        self.id = id
        self.username = username
        self.email = email
        self.rol = rol
        # Guardamos nombres y apellidos individualmente
        self.nombres = nombres
        self.apellidos = apellidos
        # Creamos nombre_completo para usarlo donde se necesite
        self.nombre_completo = f"{nombres} {apellidos}"
        self.is_verified = is_verified

@login_manager.user_loader
def load_user(user_id):
    try:
        user_data = controlador_user.obtener_usuario_por_id(user_id)
        if user_data:
            return User(
                id=user_data['id_usuario'],
                username=user_data['username'],
                email=user_data['email'],
                rol=user_data['rol'],
                nombres=user_data.get('nombres', ''),
                apellidos=user_data.get('apellidos', ''),
                is_verified=user_data.get('is_verified', False)
            )
        return None
    except Exception as e:
        app.logger.error(f"Error en user_loader: {e}")
        return None

# --- FUNCIONES AUXILIARES PARA VERIFICACIÓN ---
def generar_codigo_verificacion():
    """Genera un código de 6 dígitos aleatorios."""
    return ''.join(random.choices(string.digits, k=6))

def enviar_codigo_email(email, codigo, tipo='verificacion'):
    """Envía un email usando Flask-Mail (Gmail)."""
    try:
        if tipo == 'verificacion':
            subject = 'Código de Verificación para Smartquiz'
            body_content = f'Hola,\n\nTu código de verificación es: {codigo}\n\nIngresa este código para activar tu cuenta.\n\nSaludos,\nEl equipo de Smartquiz'
        elif tipo == 'recuperacion':
            subject = 'Código de Recuperación de Contraseña'
            body_content = f'Hola,\n\nTu código para recuperar tu contraseña es: {codigo}\n\nIngresa este código para poder cambiar tu contraseña.\n\nSaludos,\nEl equipo de Smartquiz'
        else:
             return False # Tipo no válido

        msg = Message(subject, recipients=[email], body=body_content)
        mail.send(msg)
        return True
    except Exception as e:
        app.logger.error(f"Error al enviar email con Flask-Mail: {e}")
        return False

def encriptar_sha256(cadena):
    cadbytes = cadena.encode('utf-8')
    sha256_hash_object = hashlib.sha256()
    sha256_hash_object.update(cadbytes)
    hex_digest = sha256_hash_object.hexdigest()
    return hex_digest

# --- RUTAS PRINCIPALES Y DE AUTENTICACIÓN ---

# @app.route('/')
# def inicio():
#     return render_template('inicio.html')

@app.route('/')
def inicio():
    # Si el usuario YA está logueado, lo redirige a su dashboard
    if current_user.is_authenticated:
        if current_user.rol == 'admin':
            return redirect(url_for('listar_usuarios'))
        elif current_user.rol == 'profesor':
            return redirect(url_for('inicioProfesores'))
        elif current_user.rol == 'alumno':
            return redirect(url_for('inicioAlumno'))

    # Si NO está logueado, muestra la página de inicio normal
    return render_template('inicio.html')

@app.route('/registro', methods=['GET', 'POST'])
def registro():
    if request.method == 'POST':
        nombres = request.form.get('nombres')
        apellidos = request.form.get('apellidos')
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        rol = request.form.get('role')

        if not (email.endswith('@usat.edu.pe') or email.endswith('@usat.pe')):
            flash('Solo se permiten correos electrónicos con dominio @usat.edu.pe o @usat.pe.', 'danger')
            return redirect(url_for('registro'))

        if controlador_user.verificar_existencia_usuario(email, username):
            flash('El correo electrónico o el nombre de usuario ya existen.', 'danger')
            return redirect(url_for('registro'))

        verification_code = generar_codigo_verificacion()
        hashed_password = encriptar_sha256(password)

        try:
            controlador_user.crear_usuario(
                nombres, apellidos, username, email, hashed_password, rol,
                verification_code=verification_code, is_verified=False
            )

            if not enviar_codigo_email(email, verification_code, tipo='verificacion'):
                flash('Usuario registrado, pero hubo un error al enviar el email de verificación.', 'warning')
                return redirect(url_for('login'))

            flash('¡Registro exitoso! Revisa tu email para confirmar tu cuenta.', 'success')
            return redirect(url_for('confirmar_email', email=email))

        except Exception as e:
            app.logger.error(f"Error en el registro: {e}")
            flash("Ocurrió un error durante el registro.", "danger")
            return redirect(url_for('registro'))
    return render_template('registro.html')

@app.route('/confirmar_email', methods=['GET', 'POST'])
def confirmar_email():
    email = request.args.get('email') or request.form.get('email')
    if not email:
        flash('Email no proporcionado.', 'danger')
        return redirect(url_for('registro'))

    if request.method == 'POST':
        codigo_ingresado = request.form.get('codigo')
        user_data = controlador_user.obtener_usuario_por_email(email)

        if user_data and user_data.get('verification_code') == codigo_ingresado and not user_data.get('is_verified'):
            try:
                controlador_user.verificar_usuario(email)
                flash('¡Cuenta verificada exitosamente! Ahora puedes iniciar sesión.', 'success')
                return redirect(url_for('login'))
            except Exception as e:
                app.logger.error(f"Error verificando usuario: {e}")
                flash('Error al verificar la cuenta.', 'danger')
        else:
            flash('Código incorrecto o la cuenta ya ha sido verificada.', 'danger')
    return render_template('confirmarCorreo.html', email=email)

@app.route('/reenviar-codigo', methods=['POST'])
def reenviar_codigo():
    try:
        data = request.get_json()
        email = data.get('email')
        if not email:
            return jsonify({'success': False, 'error': 'Email no proporcionado'}), 400
        user_data = controlador_user.obtener_usuario_por_email(email)
        if not user_data:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
        new_code = generar_codigo_verificacion()
        controlador_user.guardar_codigo_recuperacion(email, new_code)
        if enviar_codigo_email(email, new_code, tipo='verificacion'):
            return jsonify({'success': True, 'message': 'Código reenviado exitosamente'}), 200
        else:
            return jsonify({'success': False, 'error': 'Error al enviar el email'}), 500
    except Exception as e:
        app.logger.error(f"Error en /reenviar-codigo: {e}")
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

@app.route('/recuperar_contrasena', methods=['GET', 'POST'])
def recuperar_contrasena():
    if request.method == 'POST':
        email = request.form.get('email')
        if not (email.endswith('@usat.edu.pe') or email.endswith('@usat.pe')):
            flash('Solo se permiten correos con dominio @usat.edu.pe o @usat.pe.', 'danger')
            return redirect(url_for('recuperar_contrasena'))

        user_data = controlador_user.obtener_usuario_por_email(email)
        if user_data:
            verification_code = generar_codigo_verificacion()
            controlador_user.guardar_codigo_recuperacion(email, verification_code)
            if enviar_codigo_email(email, verification_code, tipo='recuperacion'):
                flash('Código de recuperación enviado a tu email.', 'success')
                return redirect(url_for('cambiar_contrasena', email=email))
            else:
                flash('Error al enviar el email de recuperación.', 'danger')
        else:
            flash('No se encontró una cuenta con ese email.', 'danger')
    return render_template('recuperarContraseña.html')

@app.route('/cambiar_contrasena', methods=['GET', 'POST'])
def cambiar_contrasena():
    email = request.args.get('email') or request.form.get('email')
    if not email:
        flash('Email no proporcionado.', 'danger')
        return redirect(url_for('recuperar_contrasena'))
    if request.method == 'POST':
        codigo_ingresado = request.form.get('codigo')
        nueva_password = request.form.get('password')
        user_data = controlador_user.obtener_usuario_por_email(email)
        if user_data and user_data.get('verification_code') == codigo_ingresado:
            try:
                hashed_password = encriptar_sha256(nueva_password)
                controlador_user.cambiar_contrasena(email, hashed_password)
                flash('Contraseña cambiada exitosamente. Inicia sesión.', 'success')
                return redirect(url_for('login'))
            except Exception as e:
                app.logger.error(f"Error cambiando contraseña: {e}")
                flash('Error al cambiar la contraseña.', 'danger')
        else:
            flash('El código de recuperación es incorrecto.', 'danger')
    return render_template('cambiarContraseña.html', email=email)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        identifier = request.form.get('username_or_email')
        password = request.form.get('password')
        user_data = controlador_user.obtener_usuario_por_identificador(identifier)

        # --- 1. Verificación de credenciales ---
        if user_data and user_data['password_hash'] == encriptar_sha256(password):

            # Verificación de cuenta (si no está verificada, redirecciona inmediatamente)
            if not user_data.get('is_verified', False):
                flash('Debes verificar tu email antes de iniciar sesión. Revisa tu correo.', 'warning')
                return redirect(url_for('confirmar_email', email=user_data['email']))

            # 2. Inicializar sesión principal (Flask-Login)
            user = User(
                id=user_data['id_usuario'],
                username=user_data['username'],
                email=user_data['email'],
                rol=user_data['rol'],
                nombres=user_data.get('nombres',''),
                apellidos=user_data.get('apellidos',''),
                is_verified=user_data.get('is_verified', False)
            )
            login_user(user)

            session.permanent = True  # ← ✅ AÑADE ESTA LÍNEA
            app.permanent_session_lifetime = timedelta(days=7)  # ← AÑADE TAMBIÉN ESTA

            # 3. Guardar datos en la sesión interna de Flask
            user_id = user_data['id_usuario']
            user_full_name = f"{user_data.get('nombres','')} {user_data.get('apellidos','')}"
            session['user_id_cookie_internal'] = user_id
            session['user_name_cookie_internal'] = user_full_name

            app.logger.info(f"✅ SESIÓN INICIADA. ID en session: {user_id}")
            app.logger.info(f"✅ SESIÓN INICIADA. Nombre en session: {user_full_name}")

            # 4. Determinar la URL de redirección (GUARDAR EN VARIABLE)
            if user.rol == 'admin':
                redirect_url = url_for('listar_usuarios')
            elif user.rol == 'profesor':
                redirect_url = url_for('inicioProfesores')
            else:
                redirect_url = url_for('inicioAlumno')

            # 5. Crear el objeto de respuesta y adjuntar las cookies SHA256
            resp = make_response(redirect(redirect_url))

            # Cookies encriptadas con SHA256 (como tu ejemplo)
            resp.set_cookie('user_id_enc', encriptar_sha256(str(user_id)), secure=True, httponly=True)
            resp.set_cookie('user_name_enc', encriptar_sha256(user_full_name), secure=True, httponly=True)

            # 6. Devolver la respuesta con la redirección y las cookies
            return resp

        else:
            flash('Usuario o contraseña incorrectos.', 'danger')
            return redirect(url_for('login'))

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    # Guarda el ID para el log antes de eliminarlo
    user_id_a_eliminar = session.get('user_id_cookie_internal', 'N/A')

    # 1. Eliminar variables de sesión interna
    session.pop('user_id_cookie_internal', None)
    session.pop('user_name_cookie_internal', None)

    # 1. Limpia todo el contenido de la sesión (incluye los datos internos)
    session.clear() # <--- USA ESTE COMANDO PARA LIMPIAR TODO EL DICCIONARIO

    # 2. Cerrar sesión de Flask-Login
    logout_user()

    # Muestra el valor que se está cerrando en la CONSOLA del servidor
    app.logger.info(f"❌ SESIÓN CERRADA. ID eliminado: {user_id_a_eliminar}")

    # 3. Preparar la respuesta de redirección y el mensaje flash
    flash('Has cerrado sesión exitosamente.', 'info')
    resp = make_response(redirect(url_for('inicio')))

    # 4. Eliminar las cookies personalizadas con SHA256 (forzar expires=0)
    # Se recomienda secure=True y httponly=True si estás en producción con HTTPS
    resp.set_cookie('user_id_enc', '', expires=0, secure=True, httponly=True)
    resp.set_cookie('user_name_enc', '', expires=0, secure=True, httponly=True)

    return resp

@app.route('/miPerfil')
@login_required
def miPerfil():
    return render_template('miPerfil.html')
# --- ¡NUEVAS RUTAS PARA GESTIÓN DE PERFIL DE USUARIO! ---
@app.route('/actualizar-perfil', methods=['POST'])
@login_required
def actualizar_perfil():
    try:
        nombres = request.form.get('nombres')
        apellidos = request.form.get('apellidos')
        username = request.form.get('username')
        controlador_user.actualizar_datos_perfil(current_user.id, nombres, apellidos, username)
        flash('¡Tu perfil ha sido actualizado exitosamente!', 'success')
    except Exception as e:
        app.logger.error(f"Error al actualizar perfil: {e}")
        flash('Ocurrió un error al actualizar tu perfil.', 'danger')
    return redirect(url_for('miPerfil'))

@app.route('/cambiar-mi-contrasena', methods=['POST'])
@login_required
def cambiar_mi_contrasena():
    contrasena_actual = request.form.get('contrasena_actual')
    nueva_contrasena = request.form.get('nueva_contrasena')
    confirmar_contrasena = request.form.get('confirmar_contrasena')

    if nueva_contrasena != confirmar_contrasena:
        flash('La nueva contraseña y su confirmación no coinciden.', 'danger')
        return redirect(url_for('miPerfil'))

    user_data = controlador_user.obtener_usuario_por_id(current_user.id)
    if not user_data or user_data['password_hash'] != encriptar_sha256(contrasena_actual):
        flash('La contraseña actual es incorrecta.', 'danger')
        return redirect(url_for('miPerfil'))

    if len(nueva_contrasena) < 8:
        flash('La nueva contraseña debe tener al menos 8 caracteres.', 'danger')
        return redirect(url_for('miPerfil'))

    try:
        nuevo_hash = encriptar_sha256(nueva_contrasena)
        controlador_user.actualizar_contrasena(current_user.id, nuevo_hash)
        flash('¡Contraseña actualizada exitosamente!', 'success')
    except Exception as e:
        app.logger.error(f"Error al cambiar contraseña: {e}")
        flash('Ocurrió un error al cambiar la contraseña.', 'danger')
    return redirect(url_for('miPerfil'))

# EN app.py, AÑADE ESTA NUEVA RUTA:

@app.route('/api/perfil/desactivar', methods=['POST'])
@login_required
def desactivar_mi_perfil():
    """
    Realiza una baja lógica del usuario actual y cierra su sesión.
    """
    try:
        # Usamos la función que ya tienes en tu controlador
        controlador_user.cambiar_estado_usuario(current_user.id, 'Inactivo')

        # ¡Importante! Cerramos la sesión del usuario
        logout_user()

        return jsonify({'success': True, 'message': 'Tu cuenta ha sido desactivada.'})

    except Exception as e:
        app.logger.error(f"Error al desactivar perfil para {current_user.id}: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error al desactivar tu cuenta.'}), 500


# --- RUTAS PROTEGIDAS (DASHBOARDS) ---
@app.route('/inicioProfesores')
@login_required
def inicioProfesores():
    if current_user.rol != 'profesor':
        abort(403)
    return render_template('inicioProfesores.html', current_page='mis_quizzes')



@app.route('/inicioAlumno')
@login_required
def inicioAlumno():
    if current_user.rol != 'alumno':
        abort(403)
    try:

        resultados_personales = controlador_actividad.obtener_resultados_alumno(current_user.id)


        return render_template(
            'inicioAlumno.html',
            quizzes=resultados_personales,     # <-- CORREGIDO
            resultados=resultados_personales
        )

    except Exception as e:
        app.logger.error(f"Error al cargar el dashboard del alumno: {e}", exc_info=True)
        flash("No se pudieron cargar los datos en este momento.", "danger")
        return render_template('inicioAlumno.html', quizzes=[], resultados=[])



# En app.py (asegúrate de tener 'import random' al inicio)

@app.route('/explorarQuizzesAlumno')
@login_required
def explorarQuizzesAlumno():
    if current_user.rol != 'alumno':
        abort(403)
    try:
        # 1. Llama a la función de tu controlador que obtiene TODOS los quizzes públicos
        quizzes_publicos = controlador_actividad.obtener_feed_actividad()

        # 2. Define la lista de colores aleatorios
        colores = [
            'linear-gradient(45deg, #f0c419, #f5d45c)', 'linear-gradient(45deg, #4a4e69, #6b7091)',
            'linear-gradient(45deg, #63a4ff, #8ab8ff)', 'linear-gradient(45deg, #d90429, #e63946)',
            'linear-gradient(45deg, #2a9d8f, #4cc9b0)', 'linear-gradient(45deg, #f4a261, #e76f51)'
        ]

        # 3. Asigna un color a cada quiz (se usará si no tiene imagen_portada)
        for quiz in quizzes_publicos:
            quiz['color'] = random.choice(colores)

        # 4. Renderiza el NUEVO template 'explorarQuizzesAlumno.html'
        return render_template(
            'explorarQuizzesAlumno.html',
            quizzes=quizzes_publicos
        )

    except Exception as e:
        app.logger.error(f"Error al cargar explorar quizzes alumno: {e}", exc_info=True)
        flash("No se pudieron cargar los quizzes en este momento.", "danger")
        return render_template('explorarQuizzesAlumno.html', quizzes=[])


@app.route('/explorar_quizzes')
@login_required
def explorar_quizzes():
    # Solo los profesores pueden acceder
    if current_user.rol != 'profesor':
        abort(403)

    try:
        # Llama al controlador para obtener los quizzes de otros profesores
        quizzes_publicos = controlador_explorar_profesor.obtener_quizzes_publicos(excluir_id_profesor=current_user.id)
        return render_template('explorarQuizzesProfesor.html',  current_page='explorar', quizzes=quizzes_publicos)
    except Exception as e:
        app.logger.error(f"Error al cargar la página de explorar quizzes: {e}")
        flash('No se pudieron cargar los quizzes públicos en este momento.', 'danger')
        return render_template('explorarQuizzesProfesor.html', quizzes=[])



@app.route('/api/quiz/duplicar/<int:id_cuestionario>', methods=['POST'])
@login_required
def api_duplicar_quiz(id_cuestionario):
    # Solo los profesores pueden duplicar
    if current_user.rol != 'profesor':
        return jsonify({'success': False, 'message': 'Acción no autorizada'}), 403

    try:
        # Llama a la función del controlador que hace la copia en la BD
        resultado = controlador_explorar_profesor.duplicar_quiz(id_cuestionario, current_user.id)
        if resultado['success']:
            return jsonify({
                'success': True,
                'message': '¡Quiz duplicado! Ahora lo encontrarás en "Mis Quizzes".',
                'new_quiz_id': resultado['new_quiz_id']
            })
    except Exception as e:
        app.logger.error(f"Error en la API al duplicar quiz: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error al duplicar el quiz.'}), 500



#crea cuestionario
@app.route('/crear_cuestionario')
@login_required
def crear_cuestionario():
    if current_user.rol != 'profesor':
        abort(403)
    return render_template('crear_cuestionario.html')

#edita cuestionario
@app.route('/cuestionario/<int:id_cuestionario>/editar')
@login_required
def editar_cuestionario(id_cuestionario):
    if current_user.rol != 'profesor':
        abort(403)
    cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
    if not cuestionario or cuestionario.get('id_profesor_creador') != current_user.id:
        flash("No tienes permiso para editar este cuestionario.", "danger")
        return redirect(url_for('inicioProfesores'))
    return render_template('crear_cuestionario.html', id_cuestionario=id_cuestionario)

# -- esta API sirve para mostrar la página donde los alumnos ingresan el PIN y su nickname para unirse a una partida.
@app.route('/unirse')
@login_required
def unirse():
    return render_template('unirse.html')  # tu archivo dentro de /templates

# -- esta API sirve para mostrar la sala de espera del alumno validando que se hayan enviado PIN y nickname.
@app.route('/sala_espera_alumno')
def sala_espera_alumno():
    pin = request.args.get('pin')
    nickname = request.args.get('nickname')
    if not pin or not nickname:
        flash('Faltan parámetros para entrar a la sala.', 'danger')
        return redirect(url_for('inicioAlumno'))
    return render_template('sala_espera_alumno.html', pin=pin, nickname=nickname)

# --- NUEVA RUTA PARA PREVISUALIZAR QUIZZES PÚBLICOS ---
@app.route('/api/cuestionario/publico/<int:id_cuestionario>', methods=['GET'])
@login_required
def api_obtener_cuestionario_publico(id_cuestionario):
    """
    Permite a cualquier profesor ver los datos de un cuestionario público
    (para previsualización en la página de Explorar).
    """
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403

    try:
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)

        # Verificar que el cuestionario existe
        if not cuestionario:
            return jsonify({'error': 'Cuestionario no encontrado'}), 404

        # IMPORTANTE: Solo permitir acceso si es público
        if cuestionario.get('visibilidad') != 'publico':
            return jsonify({'error': 'Este cuestionario es privado'}), 403

        # Devolver los datos (sin restricción de propietario)
        return jsonify(cuestionario)

    except Exception as e:
        app.logger.error(f"Error al obtener cuestionario público {id_cuestionario}: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

# ===============================================================
# --- API PARA SALA DE ESPERA ALUMNO (NUEVAS) ---
# ===============================================================

@app.route('/api/sala-espera/<pin>')
def api_estado_sala_espera_alumno(pin):
    """
    API para que el alumno consulte el estado de la partida y la lista de grupos/jugadores.
    """
    try:
        datos_sala = controlador_sala_alumno.obtener_estado_partida_y_grupos(pin)
        if 'error' in datos_sala:
            return jsonify({'success': False, 'message': datos_sala['error']}), 404

        return jsonify({'success': True, 'datos': datos_sala})

    except Exception as e:
        app.logger.error(f"Error en api_estado_sala_espera_alumno: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500

@app.route('/api/sala-espera/unirse-grupo', methods=['POST'])
def api_alumno_unirse_grupo():
    """
    API para que un alumno se una a un grupo por sí mismo.
    """
    try:
        data = request.get_json()
        pin = data.get('pin')
        nombre_jugador = data.get('nickname')
        id_grupo = data.get('id_grupo')

        if not pin or not nombre_jugador:
            return jsonify({'success': False, 'message': 'Datos incompletos (PIN o Nickname faltante)'}), 400

        # id_grupo puede ser None (para ir a "sin grupo"), así que no lo validamos

        resultado = controlador_sala_alumno.asignar_jugador_a_grupo(pin, nombre_jugador, id_grupo)

        if resultado['success']:
            return jsonify({'success': True, 'message': f'Te has unido al grupo {id_grupo}'})
        else:
            return jsonify({'success': False, 'message': resultado['message']}), 500

    except Exception as e:
        app.logger.error(f"Error en api_alumno_unirse_grupo: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500

# --- AÑADE ESTA RUTA NUEVA a app.py ---

@app.route('/api/sala-espera/salir', methods=['POST'])
def api_alumno_salir():
    """
    API para que un alumno notifique que se va de la sala de espera.
    """
    # Usamos request.get_data() para leer los datos enviados por sendBeacon
    data = request.get_data(as_text=True)
    if not data:
        return jsonify({'success': False, 'message': 'No data'}), 400

    try:
        # Parseamos los datos que vienen como 'pin=XXXX&nickname=YYYY'
        params = dict(x.split('=') for x in data.split('&'))
        pin = params.get('pin')
        nickname = params.get('nickname')

        if not pin or not nickname:
            return jsonify({'success': False, 'message': 'Datos incompletos'}), 400

        # Usamos el controlador que creamos en el Paso 2
        exito = controlador_sala.desactivar_participante(pin, nickname)

        if exito:
            return jsonify({'success': True, 'message': 'Participante desactivado'})
        else:
            return jsonify({'success': False, 'message': 'No se pudo desactivar al participante'}), 404

    except Exception as e:
        app.logger.error(f"Error en api_alumno_salir: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno'}), 500

@app.route('/api/partida/finalizar', methods=['POST'])
@login_required
def api_finalizar_partida():
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "message": "No autorizado"}), 403

    try:
        data = request.get_json()
        pin = data.get('pin')
        if not pin:
            return jsonify({'success': False, 'message': 'PIN no proporcionado'}), 400

        # Llamamos a la nueva función del controlador
        exito = controlador_sala.finalizar_partida(pin, current_user.id)

        if exito:
            return jsonify({'success': True, 'message': 'Partida finalizada'})
        else:
            return jsonify({'success': False, 'message': 'No se pudo finalizar la partida o no eres el propietario'}), 403

    except Exception as e:
        app.logger.error(f"Error al finalizar partida con PIN {pin}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Error interno"}), 500



@app.route('/sala_profesor')
@login_required
def sala_profesor():  # <-- 1. NOMBRE CORREGIDO Y LÓGICO
    if current_user.rol != 'profesor':
        abort(403)

    pin = request.args.get('pin')
    if not pin:
        flash("No se proporcionó un PIN válido.", "danger")
        return redirect(url_for('inicioProfesores'))

    try:
        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida:
            flash("La partida no existe o ha expirado.", "danger")
            return redirect(url_for('inicioProfesores'))

        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(partida['id_cuestionario'])
        if not cuestionario or cuestionario['id_profesor_creador'] != current_user.id:
            flash("No tienes permiso para acceder a esta sala.", "danger")
            return redirect(url_for('inicioProfesores'))

    except Exception as e:
        app.logger.error(f"Error al validar PIN en sala_profesor: {e}")
        flash("Error al verificar la partida.", "danger")
        return redirect(url_for('inicioProfesores'))

    # Si todo está bien, ahora sí renderiza la plantilla
    return render_template('sala_profesor.html', pin=pin)

# ------------------------
# -- SIRVE PARA EMPEZAR LA PARTIDA ESTOS API'S
#-------------------------
@app.route('/jugar_partida')
def jugar_partida():
    pin = request.args.get('pin')
    nickname = request.args.get('nickname')

    if not pin or not nickname:
        flash('No se proporcionó PIN o nickname.', 'danger')
        return redirect(url_for('inicioAlumno'))

    try:
        quiz_data = controlador_partida.obtener_datos_para_jugar(pin, nickname)

        if not quiz_data:
            app.logger.error(f"No se encontraron datos del juego (PIN: {pin})")
            flash('No se pudieron obtener los datos del juego.', 'danger')
            return redirect(url_for('inicioAlumno'))

        session['pin'] = pin
        session['nickname'] = nickname

        # ✅ Esta línea ya era correcta, pasa `quiz_data` al HTML.
        return render_template('responderCuestionarioAlumno.html', pin=pin, nickname=nickname, quiz_data=quiz_data)

    except ValueError as ve:
        app.logger.warning(f"Intento de jugar partida no válida (PIN: {pin}): {ve}")
        flash(str(ve), 'danger')
        return redirect(url_for('inicioAlumno'))
    except Exception as e:
        app.logger.error(f"💥 Error al cargar partida (PIN: {pin}): {e}", exc_info=True)
        return f"<h1>Error en /jugar_partida</h1><p>{e}</p>", 500

@app.route('/api/juego/wait_for_update/<pin>')
@login_required
def wait_for_update(pin):
    """
    Esta es la ruta de Long Polling. Mantiene la conexión abierta.
    """
    # Crea un "evento" de espera para esta partida si no existe
    if pin not in partida_events:
        partida_events[pin] = Event()

    # El servidor espera aquí hasta 30 segundos.
    # Si otro endpoint (como 'api_siguiente_pregunta') llama a .set(), la espera termina.
    partida_events[pin].wait(timeout=1)
    partida_events[pin].clear() # Resetea el evento para la siguiente espera

    # Cuando la espera termina (por un evento o por timeout),
    # simplemente obtenemos y devolvemos el estado actual del juego.
    try:
        # Asumo que tienes una función para obtener el estado actual
        estado_actual = controlador_partida.obtener_estado_actual_partida(pin, session['nickname'])
        return jsonify(estado_actual)
    except Exception as e:
        app.logger.error(f"Error obteniendo estado en long poll para PIN {pin}: {e}")
        return jsonify({'estado_juego': 'error', 'message': 'Error interno'}), 500

@app.route('/profesor_jugando')
@login_required
def profesor_jugando():
    if current_user.rol != 'profesor':
        abort(403)
    pin = request.args.get('pin')
    return render_template('responderCuestionarioProfesor.html', pin=pin)


@app.route('/api/juego/estado_alumno')
@login_required
def api_estado_partida_alumno():
    """
    API de Long Polling para el alumno.
    Se sincroniza con la fase global del juego controlada por el profesor.
    """
    pin = session.get('pin')
    nickname = session.get('nickname')

    if not pin or not nickname:
        return jsonify({
            'estado_juego': 'error',
            'message': 'Falta PIN o nickname en la sesión'
        }), 400

    # --- Evento de sincronización para long polling ---
    if pin not in partida_events:
        partida_events[pin] = Event()

    # Espera notificación del profesor o timeout (máx. 30s)
    notified = partida_events[pin].wait(timeout=1)
    if notified:
        partida_events[pin].clear()

    try:
        estado_actual = controlador_partida.obtener_estado_actual_partida(pin, nickname)

        # --- 🔥 Ajuste de sincronización por fase ---
        # Si el juego está en curso pero sin pregunta, el alumno espera
        if estado_actual.get('estado_juego') == 'en_curso' and not estado_actual.get('pregunta_actual'):
            estado_actual['fase'] = 'esperando'

        # Si el profesor cambió a "resultado", el alumno debe mostrar su feedback
        if estado_actual.get('estado_juego') == 'en_curso' and estado_actual.get('fase') == 'resultado':
            # En esta fase el backend ya tiene el resultado del alumno en BD
            # así que no mostramos nada más hasta que llegue la siguiente pregunta
            pass

        # Si el juego ya terminó
        if estado_actual.get('estado_juego') == 'finalizado':
            estado_actual['fase'] = 'finalizado'

        return jsonify(estado_actual)

    except Exception as e:
        app.logger.error(f"Error obteniendo estado en long poll para PIN {pin}: {e}", exc_info=True)
        return jsonify({
            'estado_juego': 'error',
            'message': 'Error interno en estado_alumno'
        }), 500


@app.route('/api/juego/estado_profesor/<pin>')
@login_required
def api_estado_partida_profesor(pin):
    """
    API para que el JS del profesor obtenga el estado en tiempo real.
    Controla el cambio automático de fase (de 'pregunta' → 'resultado')
    cuando se acaba el tiempo global o todos los alumnos responden.
    """
    if current_user.rol != 'profesor':
        abort(403)

    try:
        # Obtener los datos completos del juego
        datos = controlador_partida.obtener_datos_partida_profesor(pin)

        # --- 🔥 CONTROL AUTOMÁTICO DEL TIEMPO ---
        if (
            datos.get('estado_juego') == 'en_curso'
            and datos.get('fase') == 'pregunta'
            and datos.get('pregunta_actual')
        ):
            tiempo_limite = datos['pregunta_actual'].get('tiempo_limite', 0)
            inicio_pregunta = datos['pregunta_actual'].get('inicio_pregunta')

            # Si el backend almacena la hora de inicio (datetime)
            if inicio_pregunta and tiempo_limite:
                from datetime import datetime
                if isinstance(inicio_pregunta, str):
                    # Aseguramos formato compatible
                    inicio_pregunta = datetime.fromisoformat(inicio_pregunta)

                segundos_transcurridos = (datetime.now() - inicio_pregunta).total_seconds()

                # --- Si se acaba el tiempo, cambiar automáticamente a "resultado" ---
                if segundos_transcurridos >= tiempo_limite:
                    controlador_partida.forzar_fase_resultado(pin)
                    datos = controlador_partida.obtener_datos_partida_profesor(pin)

        # --- 🔁 CONTROL ADICIONAL: todos respondieron ---
        total = datos.get('respuestas_info', {}).get('total', 0)
        respondidos = datos.get('respuestas_info', {}).get('recibidas', 0)
        if (
            datos.get('fase') == 'pregunta'
            and total > 0
            and respondidos >= total
        ):
            controlador_partida.forzar_fase_resultado(pin)
            datos = controlador_partida.obtener_datos_partida_profesor(pin)

        return jsonify(datos)

    except Exception as e:
        app.logger.error(f"Error en api_estado_partida_profesor: {e}", exc_info=True)
        return jsonify({'estado_juego': 'error', 'message': str(e)}), 500



@app.route('/api/juego/siguiente_pregunta/<pin>', methods=['POST'])
@login_required
def api_siguiente_pregunta(pin):
    """
    API para que el profesor avance a la siguiente pregunta.
    Si ya no hay más preguntas, el juego debe finalizar.
    """
    if current_user.rol != 'profesor':
        abort(403)

    try:
        # 1. Llama a la función que actualiza el orden o finaliza la partida
        resultado_avance = controlador_partida.avanzar_siguiente_pregunta(pin)

        if not resultado_avance.get('success'):
             # Si avanzar_siguiente_pregunta falló, retornar error
             return jsonify({'success': False, 'message': resultado_avance.get('message', 'Error al avanzar pregunta')}), 500

        # 2. VERIFICA si el juego REALMENTE terminó consultando el estado ACTUAL
        #    (Necesitas una función para obtener solo el estado de la partida)
        partida_actual = controlador_cuestionario.obtener_partida_por_pin(pin) # Usamos la función que ya existe
        partida_terminada = (partida_actual and partida_actual['estado'] == 'finalizada')

        # 3. Si la partida AHORA está marcada como finalizada:
        if partida_terminada:
            # --- 👇 LÍNEA PROBLEMÁTICA ELIMINADA 👇 ---
            # controlador_partida.finalizar_partida(pin) # <-- ESTA LÍNEA SE FUE

            # Notificar a todos los alumnos (Esto sí debe quedar)
            if pin in partida_events:
                partida_events[pin].set()

            return jsonify({
                'success': True,
                'finalizado': True, # Indica al frontend que el juego terminó
                'message': 'La partida ha finalizado'
            })

        # 4. Si aún quedan preguntas (el estado no es 'finalizada'):
        # Notificar a los alumnos que hay una nueva pregunta/estado
        if pin in partida_events:
            partida_events[pin].set()

        return jsonify({'success': True, 'finalizado': False})

    except Exception as e:
        app.logger.error(f"Error en api_siguiente_pregunta: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno'}), 500



@app.route('/api/juego/responder', methods=['POST'])
def api_guardar_respuesta():
    """
    Guarda la respuesta del alumno y notifica al profesor en tiempo real.
    """
    try:
        data = request.get_json()
        id_participante = data.get('id_participante')
        if not id_participante:
            app.logger.warning("Intento de guardar respuesta sin id_participante")
            return jsonify({'success': False, 'message': 'ID de participante no válido'}), 400

        # Guardar respuesta en BD y obtener resultado
        resultado = controlador_partida.guardar_respuesta_alumno(
            id_participante=id_participante,
            id_pregunta=data.get('id_pregunta'),
            id_respuesta_seleccionada=data.get('id_respuesta_seleccionada'),
            tiempo_respuesta_segundos=data.get('tiempo_respuesta_segundos')
        )

        # 🔔 Notificar al profesor que un alumno respondió
        try:
            pin_partida = controlador_partida.obtener_pin_por_participante(id_participante)
            if pin_partida:
                if pin_partida not in partida_events:
                    partida_events[pin_partida] = Event()
                partida_events[pin_partida].set()
        except Exception as e:
            app.logger.error(f"Error notificando al profesor (pin no encontrado): {e}")

        return jsonify({
            'success': True,
            'es_correcta': resultado.get('es_correcta', False),
            'puntos_obtenidos': resultado.get('puntos_obtenidos', 0)
        }), 200

    except Exception as e:
        app.logger.error(f"Error al guardar respuesta: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500


@app.route('/api/juego/forzar_resultado/<pin>', methods=['POST'])
@login_required
def api_forzar_resultado(pin):
    """
    Permite al profesor forzar el cambio de fase a 'resultado'
    (por ejemplo, cuando termina el tiempo global o todos respondieron).
    """
    if current_user.rol != 'profesor':
        abort(403)

    try:
        # --- Cambiar la fase de la partida ---
        controlador_partida.forzar_fase_resultado(pin)

        # --- Notificar a todos los alumnos conectados ---
        if pin in partida_events:
            partida_events[pin].set()

        app.logger.info(f"El profesor {current_user.username} forzó resultado para PIN {pin}")
        return jsonify({'success': True})

    except Exception as e:
        app.logger.error(f"Error en api_forzar_resultado ({pin}): {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

# API para obtener estadísticas históricas de una pregunta específica (Modo Revisión)
@app.route('/api/juego/historial/<pin>/<int:indice_pregunta>', methods=['GET'])
@login_required
def api_historial_pregunta(pin, indice_pregunta):
    if current_user.rol != 'profesor':
        return jsonify({'error': 'No autorizado'}), 403

    try:
        # 1. Obtener la partida
        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida:
            return jsonify({'error': 'Partida no encontrada'}), 404

        # 2. Obtener todas las preguntas del cuestionario ordenadas
        preguntas = controlador_pregunta.obtener_preguntas_completas_por_cuestionario(partida['id_cuestionario'])

        # 3. Validar índice (0 a N-1)
        if indice_pregunta < 0 or indice_pregunta >= len(preguntas):
            return jsonify({'error': 'Índice fuera de rango'}), 404

        pregunta_target = preguntas[indice_pregunta]
        id_pregunta = pregunta_target['id_pregunta']

        # 4. Calcular estadísticas para esa pregunta (reutilizamos lógica existente o creamos query)
        # Aquí simulamos la llamada a tu controlador de estadísticas actual
        estadisticas = controlador_partida.obtener_estadisticas_pregunta(partida['id_partida'], id_pregunta)

        return jsonify({
            'success': True,
            'pregunta': pregunta_target,
            'estadisticas': estadisticas,
            'total_preguntas': len(preguntas),
            'indice_actual': indice_pregunta
        })

    except Exception as e:
        app.logger.error(f"Error en historial: {e}", exc_info=True)
        return jsonify({'error': 'Error interno'}), 500



@app.route('/api/juego/finalizar', methods=['POST'])
def api_finalizar_partida_alumno():
    """
    API para que el JS del alumno guarde la puntuación final.
    """
    try:
        data = request.get_json()
        controlador_partida.guardar_puntuacion_final(
            id_participante=data.get('id_participante'),
            puntuacion_total=data.get('score')
        )
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error al finalizar partida: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error en el servidor'}), 500


@app.route('/api/juego/exportar/<pin>', methods=['GET'])
@login_required
def api_exportar_resultados(pin):
    """
    Genera y descarga un Excel con los resultados de la partida (por PIN).
    Columnas: Nombre, Puntaje total, Pregunta N: [texto].
    """
    if current_user.rol != 'profesor':
        abort(403)

    try:
        file_obj, filename = controlador_partida.exportar_resultados_excel(pin)
        file_obj.seek(0)
        return send_file(
            file_obj,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        app.logger.error(f"Error exportando resultados para PIN {pin}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error al exportar los datos.'}), 500


# ------------------------
# ------------------------
#-------------------------

# --- IMPORTACION  PARA CREAR CUESTIONARIOS POR MEDIO DE UN EXCEL ---
@app.route('/importar_quiz')
@login_required
def importar_quiz_form():
    """Muestra la página con el formulario para subir el Excel."""
    if current_user.rol != 'profesor':
        abort(403)
    return render_template('importar_quiz.html')


@app.route('/api/cuestionario/importar', methods=['POST'])
@login_required
def api_importar_quiz():
    """
    Recibe el archivo Excel, lo procesa y crea un nuevo cuestionario.
    """
    if current_user.rol != 'profesor':
        abort(403)

    try:
        # 1. Validar que los datos del formulario existan
        if 'file' not in request.files:
            flash('No se encontró el archivo en la solicitud.', 'danger')
            return redirect(url_for('importar_quiz_form'))

        file = request.files['file']
        titulo_quiz = request.form.get('titulo')

        if file.filename == '':
            flash('No se seleccionó ningún archivo.', 'danger')
            return redirect(url_for('importar_quiz_form'))

        if not titulo_quiz:
            flash('El título del quiz es obligatorio.', 'danger')
            return redirect(url_for('importar_quiz_form'))

        # 2. Procesar el archivo
        if file:
            # (Pandas puede leer el objeto 'file' directamente de la memoria)

            # 3. Llamar al controlador de Excel para parsearlo
            preguntas_json = controladorExcel.parsear_excel_a_json(file)
            import json
            app.logger.info("✅ Preguntas JSON generadas: %s", json.dumps(preguntas_json, indent=2, ensure_ascii=False))



            if not preguntas_json:
                flash('El Excel está vacío o no tiene preguntas.', 'danger')
                return redirect(url_for('importar_quiz_form'))

            # 4. Llamar al controlador de Cuestionario para CREAR el quiz
            controlador_cuestionario.crear_cuestionario_completo(
                titulo=titulo_quiz,
                descripcion="Cuestionario importado desde Excel.",
                visibilidad='privado', # Por defecto
                id_profesor_creador=current_user.id,
                preguntas=preguntas_json,
                recompensas=[], # El Excel no maneja recompensas
                estado='Activo' # Lo creamos como activo
            )

            flash(f'¡Quiz "{titulo_quiz}" importado exitosamente!', 'success')
            return redirect(url_for('inicioProfesores'))

    except ValueError as ve:
        app.logger.error(f"Error de formato en Excel: {ve}")
        flash(f"Error al leer el Excel: {ve}", 'danger')
        return redirect(url_for('importar_quiz_form'))
    except Exception as e:
        app.logger.error(f"Error al importar quiz: {e}", exc_info=True)
        flash('Ocurrió un error inesperado al procesar el archivo.', 'danger')
        return redirect(url_for('importar_quiz_form'))


@app.route('/descargar_plantilla_excel')
@login_required
def descargar_plantilla_excel():
    """
    Permite al usuario descargar el archivo 'plantilla_smartquiz.xlsx'
    que subiste a la carpeta 'static/'.
    """
    try:
        # Devuelve el archivo desde la carpeta 'static'
        return send_from_directory(
            app.static_folder, # La ruta a tu carpeta 'static'
            'plantilla_smartquiz.xlsx',
            as_attachment=True # Esto fuerza la descarga
        )
    except Exception as e:
        app.logger.error(f"Error al descargar plantilla: {e}")
        flash("No se pudo encontrar el archivo de plantilla.", "danger")
        return redirect(url_for('importar_quiz_form'))

# -------------------------------------------------------------------


# -- esta API sirve para actualizar el nombre de un participante en una partida, verificando que no esté en uso.
@app.route('/api/actualizar_nombre_participante', methods=['POST'])
def api_actualizar_nombre_participante():
    try:
        data = request.get_json()
        pin = data.get('pin')
        old_name = data.get('old_name')
        new_name = data.get('new_name')

        if not pin or not old_name or not new_name:
            return jsonify({'success': False, 'message': 'Datos incompletos'}), 400

        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida:
            return jsonify({'success': False, 'message': 'Partida no encontrada'}), 404

        if controlador_cuestionario.existe_participante_en_partida(partida['id_partida'], new_name):
            return jsonify({'success': False, 'message': 'Nombre ya en uso'}), 409

        controlador_cuestionario.actualizar_nombre_participante(
            id_partida=partida['id_partida'],
            old_name=old_name,
            new_name=new_name
        )
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error al actualizar nombre: {e}")
        return jsonify({'success': False, 'message': 'Error interno'}), 500

# -- esta API sirve para obtener el estado actual (esperando/en_curso/finalizada) de una partida por su PIN.
@app.route('/api/estado_partida/<pin>')
def api_estado_partida(pin):
    try:
        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida:
            return jsonify({'error': 'Partida no encontrada'}), 404
        return jsonify({'estado': partida['estado']})
    except Exception as e:
        app.logger.error(f"Error al obtener estado: {e}")
        return jsonify({'error': 'Error interno'}), 500

# -- esta API sirve para verificar si un PIN es válido y corresponde a una partida en estado "esperando".
@app.route('/api/game/verify-pin', methods=['POST'])
def verify_pin():
    try:
        data = request.get_json()
        pin = data.get('pin')
        if not pin:
            return jsonify({'success': False, 'message': 'PIN no proporcionado'}), 400

        # Buscar partida por PIN
        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida or partida.get('estado') != 'esperando':
            return jsonify({'success': False, 'message': 'PIN inválido o juego ya iniciado'}), 404

        return jsonify({
            'success': True,
            'gameId': partida['id_partida']
        })
    except Exception as e:
        app.logger.error(f"Error en verify_pin: {e}")
        return jsonify({'success': False, 'message': 'Error interno'}), 500

# -- esta API sirve para registrar a un nuevo participante en una partida, validando nombre único y estado de la partida.
@app.route('/api/game/join', methods=['POST'])
def join_game():
    try:
        data = request.get_json()
        pin = data.get('pin')
        player_name = data.get('playerName')

        id_alumno_logueado = current_user.id

        if not pin or not player_name:
            return jsonify({'success': False, 'message': 'Faltan datos'}), 400

        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida or partida.get('estado') != 'esperando':
            return jsonify({'success': False, 'message': 'Partida no disponible'}), 404

        # Verificar que el nombre no esté repetido en la misma partida
        if controlador_cuestionario.existe_participante_en_partida(partida['id_partida'], player_name):
            return jsonify({'success': False, 'message': 'Ya existe un participante con ese nombre'}), 409

        # Registrar al participante
        participante_id = controlador_cuestionario.registrar_participante(
            id_partida=partida['id_partida'],
            nombre=player_name,
            id_usuario_alumno=id_alumno_logueado
        )

        return jsonify({
            'success': True,
            'playerId': participante_id,
            'gameId': partida['id_partida']
        })
    except Exception as e:
        app.logger.error(f"Error en join_game: {e}")
        return jsonify({'success': False, 'message': 'Error al unirse'}), 500

# En app.py, reemplaza esta función:

@app.route('/api/iniciar_cuestionario/<pin>', methods=['POST'])
def iniciar_cuestionario(pin):
    """
    API para que el profesor inicie el juego.
    Ahora establece la primera pregunta automáticamente.
    """
    try:
        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida or partida.get('estado') != 'esperando':
            return jsonify({'success': False, 'message': 'La partida no existe o ya ha comenzado.'}), 404

        id_cuestionario = partida['id_cuestionario']
        id_partida = partida['id_partida']

        # 1. Busca el número de orden de la primera pregunta
        primer_orden = controlador_partida.obtener_orden_primera_pregunta(id_cuestionario)
        if not primer_orden:
            return jsonify({'success': False, 'message': 'Error: El cuestionario no tiene preguntas.'}), 400

        # 2. Actualiza la partida para que esté "en_curso" Y con la primera pregunta ya activa
        controlador_partida.actualizar_partida_para_inicio(id_partida, primer_orden)

        # 3. Despierta a los alumnos que están esperando en el long polling
        if pin in partida_events:
            partida_events[pin].set()

        return jsonify({'success': True, 'message': '¡Juego iniciado!'})

    except Exception as e:
        app.logger.error(f"Error al iniciar cuestionario con PIN {pin}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Ocurrió un error interno al iniciar el juego.'}), 500

@app.route('/api/iniciar_sesion_clase', methods=['POST'])
@login_required
def iniciar_sesion_clase():
    if current_user.rol != 'profesor':
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    data = request.get_json()
    id_cuestionario_raw = data.get('id_cuestionario')

    try:
        id_cuestionario = int(id_cuestionario_raw)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'ID de cuestionario inválido'}), 400

    try:
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario:
            return jsonify({'success': False, 'message': 'El cuestionario no existe'}), 404
        if cuestionario.get('id_profesor_creador') != current_user.id:
            return jsonify({'success': False, 'message': 'Cuestionario no pertenece al usuario'}), 403

        pin_permanente = cuestionario.get('pin_permanente')
        pin_a_usar = None

        if not pin_permanente:
            caracteres_pin = string.ascii_uppercase + string.digits
            pin_generado = None
            for _ in range(100): # Intentar 100 veces
                posible_pin = ''.join(secrets.choice(caracteres_pin) for _ in range(6))
                # Verificar si ya existe en Cuestionario O Partida
                if not controlador_cuestionario.existe_pin_en_cuestionario(posible_pin) and \
                   not controlador_cuestionario.obtener_partida_por_pin(posible_pin):
                    pin_generado = posible_pin
                    break

            if not pin_generado:
                app.logger.error(f"No se pudo generar un PIN único para cuestionario {id_cuestionario} tras 100 intentos.")
                return jsonify({'success': False, 'message': 'No se pudo generar PIN único'}), 500

            try:
                controlador_cuestionario.guardar_pin_permanente(id_cuestionario, pin_generado)
                pin_a_usar = pin_generado
            except Exception as db_err:
                app.logger.error(f"Error al guardar PIN permanente {pin_generado} para cuestionario {id_cuestionario}: {db_err}", exc_info=True)
                return jsonify({'success': False, 'message': 'Error al guardar el nuevo PIN en la base de datos.'}), 500
        else:
            pin_a_usar = pin_permanente

        # --- INICIO DE LA CORRECCIÓN ---
        # 1. Buscar si ya existe una partida (incluso 'finalizada') con este PIN
        partida_existente = controlador_cuestionario.obtener_partida_por_pin(pin_a_usar)

        if partida_existente:
            id_partida_vieja = partida_existente['id_partida']
            app.logger.info(f"PIN {pin_a_usar} detectado. Limpiando participantes de partida anterior (ID: {id_partida_vieja}).")

            # 2. Borrar todos los participantes de esa partida anterior
            controlador_sala.eliminar_participantes_de_partida(id_partida_vieja)

            # 3. Opcional: Borrar la partida anterior para empezar de cero
            # controlador_cuestionario.eliminar_partida_por_id(id_partida_vieja)
            # (Necesitarías crear esta función si quieres borrar la partida completa)

            # Por ahora, solo limpiaremos los participantes, pero es mejor
            # crear una nueva partida o reactivar la existente.

            # Vamos a reactivar la partida existente:
            controlador_cuestionario.actualizar_estado_partida(partida_existente['id_partida'], 'esperando')
            id_partida_a_usar = partida_existente['id_partida']

        else:
            # 7. Si no hay partida, crear una nueva
            app.logger.info(f"Creando nueva partida para PIN {pin_a_usar}")
            id_partida_nueva = controlador_cuestionario.crear_partida(
                id_cuestionario=id_cuestionario,
                pin=pin_a_usar,
                estado='esperando'
            )
            if not id_partida_nueva:
                app.logger.error(f"Falló el INSERT al intentar crear partida con PIN {pin_a_usar} para cuestionario {id_cuestionario}")
                return jsonify({'success': False, 'message': 'Error al crear la partida en la base de datos'}), 500
            id_partida_a_usar = id_partida_nueva

        return jsonify({'success': True, 'pin': pin_a_usar})

    except Exception as e:
        app.logger.error(f"Error general en iniciar_sesion_clase: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno al procesar la solicitud.'}), 500


@app.route('/jugar/<int:id_cuestionario>')
@login_required
def jugar_quiz(id_cuestionario):
    try:
        quiz_data = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)

        if not quiz_data:
            flash('Este cuestionario no está disponible.', 'danger')
            return redirect(url_for('inicioAlumno'))

        # VALIDACIÓN: Solo permite si es PÚBLICO
        if quiz_data.get('visibilidad') != 'publico':
            if not current_user.is_authenticated or quiz_data.get('id_profesor_creador') != current_user.id:
                flash('Este cuestionario es privado.', 'danger')
                return redirect(url_for('inicioAlumno'))

        if not quiz_data.get('preguntas'):
            flash('Este cuestionario no tiene preguntas aún.', 'warning')
            return redirect(url_for('inicioAlumno'))

        # 🎮 Renderizar el HTML de juego SOLO (sin conexión al servidor)
        return render_template('jugarQuizSolo.html', quiz_data=quiz_data)

    except Exception as e:
        app.logger.error(f"Error al intentar jugar el quiz {id_cuestionario}: {e}", exc_info=True)
        flash('Ocurrió un error al cargar el juego.', 'danger')
        return redirect(url_for('inicioAlumno'))

#-- BOTON Previsualizar en explorar en inicio Profesores
@app.route('/previsualizar/<int:id_cuestionario>')
@login_required
def previsualizar_quiz(id_cuestionario):
    if current_user.rol != 'profesor':
        abort(403)
    try:
        # --- MENSAJE DE DEPURACIÓN ---
        app.logger.info(f"Intentando previsualizar quiz con ID: {id_cuestionario}")
        # --- FIN MENSAJE DE DEPURACIÓN ---

        quiz_data = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not quiz_data:
            app.logger.warning(f"Quiz con ID {id_cuestionario} no encontrado.")
            flash('Este cuestionario no está disponible.', 'danger')
            return redirect(url_for('explorar_quizzes'))

        if not quiz_data.get('preguntas'):
            app.logger.warning(f"Quiz con ID {id_cuestionario} no tiene preguntas.")
            flash('Este cuestionario no tiene preguntas aún.', 'warning')
            return redirect(url_for('explorar_quizzes'))

        # --- MENSAJE DE DEPURACIÓN ---
        app.logger.info(f"Quiz encontrado: {quiz_data.get('titulo', 'Sin título')}")
        # --- FIN MENSAJE DE DEPURACIÓN ---

        return render_template('responderCuestionarioAlumno.html', quiz_data=quiz_data, is_preview=True)

    except Exception as e:
        app.logger.error(f"Error al previsualizar quiz {id_cuestionario}: {e}", exc_info=True)
        flash('No se pudo cargar la previsualización.', 'danger')
        return redirect(url_for('explorar_quizzes'))

# -- esta API sirve para obtener la lista de participantes registrados en una partida usando su PIN.
@app.route('/api/participantes/<pin>')
def obtener_participantes(pin):
    try:
        participantes = controlador_sala.obtener_participantes_por_pin(pin)
        return jsonify({"success": True, "participantes": participantes})
    except Exception as e:
        app.logger.error(f"Error en /api/participantes/{pin}: {e}")
        return jsonify({"success": False, "message": "Error interno"}), 500



# ===============================================================
# --- RUTA PARA ENVIAR LOS RESULTADOS POR CORREO ---
# ===============================================================
@app.route('/api/juego/enviar_email/<pin>', methods=['POST'])
@login_required
def api_enviar_resultados_por_correo(pin):
    """
    Genera el Excel de resultados y lo envía por email al profesor logueado.
    - Adjunta el archivo .xlsx
    - Asunto: Resultados SmartQuiz (PIN ...)
    - Cuerpo: texto simple con un link para descargar local si hiciera falta
    """
    if current_user.rol != 'profesor':
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    try:
        # 1) Opcionalmente valida que el profesor sea dueño de la partida
        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida:
            return jsonify({'success': False, 'message': 'Partida no encontrada'}), 404

        # Si quieres validar propiedad:
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(partida['id_cuestionario'])
        if not cuestionario or cuestionario.get('id_profesor_creador') != current_user.id:
            return jsonify({'success': False, 'message': 'No tienes permiso sobre esta partida'}), 403

        # 2) Generar el Excel en memoria
        file_obj, filename = controlador_partida.exportar_resultados_excel(pin)
        file_obj.seek(0)
        binary_data = file_obj.read()

        # 3) Construir el mensaje
        destinatario = current_user.email  # ← se envía al correo con el que se registró
        asunto = f"Resultados SmartQuiz (PIN {pin})"
        cuerpo = (
            f"Hola {current_user.nombres or ''},\n\n"
            f"Adjuntamos el Excel con los resultados del juego con PIN {pin}.\n\n"
            f"Saludos,\nSmartQuiz"
        )

        msg = Message(
            subject=asunto,
            recipients=[destinatario],
            body=cuerpo
        )

        # 4) Adjuntar el Excel
        msg.attach(
            filename,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            binary_data
        )

        # 5) Enviar
        mail.send(msg)

        return jsonify({'success': True, 'message': f'Resultados enviados a {destinatario}'})

    except Exception as e:
        app.logger.error(f"Error enviando resultados por correo (PIN {pin}): {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error al enviar el correo.'}), 500



# ===============================================================
# --- RUTAS DE GESTIÓN DE USUARIOS (CRUD con Baja Lógica) ---
# ===============================================================
@app.route('/usuarios')
@login_required
def listar_usuarios():
    if current_user.rol != 'admin':
        abort(403)
    try:
        todos_los_usuarios = controlador_user.obtener_todos_los_usuarios()
        return render_template('usuarios.html', usuarios=todos_los_usuarios)
    except Exception as e:
        app.logger.error(f"Error al listar usuarios: {e}")
        flash('Hubo un error al cargar la lista de usuarios.', 'danger')
        return redirect(url_for('inicio'))

# AÑADE ESTA FUNCIÓN EN app.py

@app.route('/usuarios/editar/<int:id_usuario>')
@login_required
def editar_usuario_form(id_usuario):
    if current_user.rol != 'admin':
        abort(403)

    usuario = controlador_user.obtener_usuario_por_id(id_usuario)

    if not usuario:
        flash('Usuario no encontrado.', 'danger')
        return redirect(url_for('listar_usuarios'))

    return render_template('edit_usuario.html', usuario=usuario)

@app.route('/usuarios/nuevo')
@login_required
def nuevo_usuario_form():
    if current_user.rol != 'admin':
        abort(403)
    return render_template('add_usuario.html')

@app.route('/usuarios/crear', methods=['POST'])
@login_required
def crear_usuario():
    if current_user.rol != 'admin':
        abort(403)
    try:
        nombres = request.form['nombres']
        apellidos = request.form['apellidos']
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        rol = request.form['rol']

        # --- VALIDACIÓN AÑADIDA AQUÍ ---
        if not (email.endswith('@usat.edu.pe') or email.endswith('@usat.pe')):
            flash('Solo se permiten correos con dominio @usat.edu.pe o @usat.pe.', 'danger')
            # Si la validación falla, volvemos al formulario de creación
            return redirect(url_for('nuevo_usuario_form'))
        # --- FIN DE LA VALIDACIÓN ---

        hashed_password = encriptar_sha256(password)
        controlador_user.crear_usuario(nombres, apellidos, username, email, hashed_password, rol, is_verified=True)
        flash('Usuario creado exitosamente.', 'success')
    except Exception as e:
        app.logger.error(f"Error al crear usuario: {e}")
        flash('Hubo un error al crear el usuario.', 'danger')

    return redirect(url_for('listar_usuarios'))

# EN app.py
@app.route('/api/sala-espera/estado-inicial/<pin>')
def api_estado_inicial_sala_espera_alumno(pin):
    """
    Devuelve el estado ACTUAL de la sala sin esperar (sin long polling).
    """
    try:
        datos_sala = controlador_sala_alumno.obtener_estado_partida_y_grupos(pin)
        if 'error' in datos_sala:
            return jsonify({'success': False, 'message': datos_sala['error']}), 404
        return jsonify({'success': True, 'datos': datos_sala})
    except Exception as e:
        app.logger.error(f"Error en api_estado_inicial_sala_espera_alumno: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500


@app.route('/usuarios/actualizar/<int:id_usuario>', methods=['POST'])
@login_required
def actualizar_usuario(id_usuario):
    if current_user.rol != 'admin':
        abort(403)
    try:
        nombres = request.form['nombres']
        apellidos = request.form['apellidos']
        username = request.form['username']
        email = request.form['email']
        rol = request.form['rol']

        # --- VALIDACIÓN AÑADIDA AQUÍ ---
        if not (email.endswith('@usat.edu.pe') or email.endswith('@usat.pe')):
            flash('Solo se permiten correos con dominio @usat.edu.pe o @usat.pe.', 'danger')
            # Si la validación falla, volvemos al formulario de edición del usuario específico
            return redirect(url_for('editar_usuario_form', id_usuario=id_usuario))
        # --- FIN DE LA VALIDACIÓN ---

        controlador_user.actualizar_usuario(id_usuario, nombres, apellidos, username, email, rol)
        flash('Usuario actualizado exitosamente.', 'success')
    except Exception as e:
        app.logger.error(f"Error al actualizar usuario: {e}")
        flash('Hubo un error al actualizar el usuario.', 'danger')

    return redirect(url_for('listar_usuarios'))

@app.route('/usuarios/desactivar/<int:id_usuario>')
@login_required
def desactivar_usuario(id_usuario):
    if current_user.rol != 'admin':
        abort(403)
    try:
        controlador_user.cambiar_estado_usuario(id_usuario, 'Inactivo')
        flash('Usuario desactivado exitosamente.', 'warning')
    except Exception as e:
        app.logger.error(f"Error al desactivar usuario: {e}")
        flash('Hubo un error al desactivar el usuario.', 'danger')
    return redirect(url_for('listar_usuarios'))

@app.route('/usuarios/reactivar/<int:id_usuario>')
@login_required
def reactivar_usuario(id_usuario):
    if current_user.rol != 'admin':
        abort(403)
    try:
        controlador_user.cambiar_estado_usuario(id_usuario, 'Activo')
        flash('Usuario reactivado exitosamente.', 'success')
    except Exception as e:
        app.logger.error(f"Error al reactivar usuario: {e}")
        flash('Hubo un error al reactivar el usuario.', 'danger')
    return redirect(url_for('listar_usuarios'))

# ===============================================================
# --- API PARA CUESTIONARIOS ---
# ===============================================================
# API para obtener los cuestionarios creados por el profesor autenticado
# Permite al profesor ver la lista de sus propios quizzes (cuestionarios)
@app.route('/api/mis-quizzes')
@login_required
def api_mis_quizzes():
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403
    try:
        mis_quizzes = controlador_cuestionario.obtener_cuestionarios_por_profesor(current_user.id)
        return jsonify(mis_quizzes)
    except Exception as e:
        app.logger.error(f"Error en api_mis_quizzes: {e}")
        return jsonify({'error': 'Error interno al obtener los quizzes'}), 500

# API para crear un nuevo cuestionario completo
# Solo accesible para profesores autenticados

@app.route('/api/cuestionario', methods=['POST'])
@login_required
def api_crear_cuestionario():
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403
    datos = request.get_json()
    if not datos:
        return jsonify({'error': 'No se recibieron datos JSON'}), 400
    estado = datos.get('estado', 'Activo')

    # ===== INICIO DE LA CORRECCIÓN =====
    # Obtener imagen_portada del JSON (puede ser None si no se envió)
    imagen_portada = datos.get('imagen_portada')
    # ===== FIN DE LA CORRECCIÓN =====

    try:
        resultado = controlador_cuestionario.crear_cuestionario_completo(
            titulo=datos.get('titulo'),
            descripcion=datos.get('descripcion'),
            visibilidad=datos.get('visibilidad'),
            id_profesor_creador=current_user.id,
            preguntas=datos.get('preguntas', []),
            recompensas=datos.get('recompensas', []),
            estado=estado,
            imagen_portada=datos.get('imagen_portada')  # ← Asegúrate que esté aquí
        )
        # Obtener el cuestionario recién creado (incluye pin_permanente, aunque sea null)
        cuestionario_guardado = controlador_cuestionario.obtener_cuestionario_por_id(resultado['id_cuestionario'])
        return jsonify({
            'mensaje': 'Cuestionario creado exitosamente',
            'id_cuestionario': cuestionario_guardado['id_cuestionario'],
            'pin_permanente': cuestionario_guardado.get('pin_permanente')  # será null al inicio
        }), 201
    except ValueError as ve:
        app.logger.error(f"Error de validación al crear cuestionario: {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error crítico al crear cuestionario: {e}", exc_info=True)
        return jsonify({'error': 'Error interno del servidor al crear'}), 500


# API para gestionar un cuestionario específico (GET, PUT, DELETE)

@app.route('/api/cuestionario/<int:id_cuestionario>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_gestionar_cuestionario(id_cuestionario):
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403

    cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
    if not cuestionario or cuestionario.get('id_profesor_creador') != current_user.id:
        return jsonify({'error': 'No tienes permiso sobre este cuestionario'}), 403

    if request.method == 'GET':
        return jsonify(cuestionario)

    if request.method == 'PUT':
        datos = request.get_json()

        if not datos:
            return jsonify({'error': 'No se recibieron datos'}), 400
        try:
            estado = datos.get('estado', cuestionario.get('estado', 'Activo'))

            # ===== INICIO MODIFICACIÓN =====
            # Obtenemos la imagen del JSON.
            # Si no viene (None), se pasará None al controlador.
            imagen_portada = datos.get('imagen_portada')
            # ===== FIN MODIFICACIÓN =====

            controlador_cuestionario.actualizar_cuestionario_completo(
                id_cuestionario=id_cuestionario,
                titulo=datos.get('titulo'),
                descripcion=datos.get('descripcion'),
                visibilidad=datos.get('visibilidad'),
                preguntas=datos.get('preguntas', []),
                recompensas=datos.get('recompensas', []),
                estado=estado,
                # ===== INICIO MODIFICACIÓN =====
                imagen_portada=imagen_portada # Pasar el parámetro
                # ===== FIN MODIFICACIÓN =====
            )

            # Obtener el cuestionario actualizado (incluye pin_permanente)
            cuestionario_actualizado = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
            return jsonify({
                'mensaje': 'Cuestionario actualizado',
                'pin_permanente': cuestionario_actualizado.get('pin_permanente')
            })
        except Exception as e:
            app.logger.error(f"Error al actualizar cuestionario {id_cuestionario}: {e}", exc_info=True)
            return jsonify({'error': 'Error interno al actualizar'}), 500

    if request.method == 'DELETE':
        try:
            controlador_cuestionario.eliminar_cuestionario_por_id(id_cuestionario)
            return jsonify({'mensaje': 'Cuestionario eliminado'})
        except Exception as e:
            app.logger.error(f"Error al eliminar cuestionario: {e}")
            return jsonify({'error': 'Error interno'}), 500

@app.route('/mis-resultados')
@login_required
def resultados_alumno():
    if current_user.rol != 'alumno':
        abort(403)
    return render_template('resultados_alumno.html')


#mueve en la papelera
@app.route('/api/cuestionario/<int:id_cuestionario>/mover-a-papelera', methods=['POST'])
@login_required
def api_mover_cuestionario_papelera(id_cuestionario):
    try:
        cuestionario_info = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario_info or cuestionario_info['id_profesor_creador'] != current_user.id:
            return jsonify({'success': False, 'message': 'Acción no autorizada.'}), 403

        # Ahora que el controlador devuelve un INT, lo usamos directamente.
        resultado = controlador_cuestionario.mover_cuestionario_a_papelera(id_cuestionario)

        # Reemplaza toda la lógica de 'isinstance' por esta línea simple:
        if resultado > 0:
            return jsonify({'success': True, 'message': 'Cuestionario movido a la papelera.'})
        else:
            return jsonify({'success': False, 'message': 'No se encontró el cuestionario.'}), 404

    except Exception as e:
        app.logger.error(f"Error al mover a la papelera: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Ocurrió un error en el servidor.'}), 500

#api para mover quizzes a papelera
@app.route('/api/mis-quizzes/papelera')
@login_required
def api_get_quizzes_papelera():
    try:
        quizzes_papelera = controlador_cuestionario.obtener_cuestionarios_en_papelera_por_profesor(current_user.id)
        return jsonify(quizzes_papelera)
    except Exception as e:
        app.logger.error(f"Error al obtener quizzes de la papelera: {e}", exc_info=True)
        return jsonify({'error': 'Error interno'}), 500

#api para restaurar el cuestionario de papelera
@app.route('/api/cuestionario/<int:id_cuestionario>/restaurar', methods=['POST'])
@login_required
def api_restaurar_cuestionario(id_cuestionario):
    try:
        cuestionario_info = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario_info or cuestionario_info['id_profesor_creador'] != current_user.id:
            return jsonify({'success': False, 'message': 'Acción no autorizada.'}), 403
        resultado = controlador_cuestionario.restaurar_cuestionario_desde_papelera(id_cuestionario)
        if resultado > 0:
            return jsonify({'success': True, 'message': 'Cuestionario restaurado.'})
        return jsonify({'success': False, 'message': 'No se pudo restaurar.'}), 404
    except Exception as e:
        app.logger.error(f"Error al restaurar: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno'}), 500

#api para eliminar permanentemente el cuestionario
@app.route('/api/cuestionario/<int:id_cuestionario>/eliminar-permanente', methods=['DELETE'])
@login_required
def api_eliminar_permanente_cuestionario(id_cuestionario):
    try:
        cuestionario_info = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario_info or cuestionario_info['id_profesor_creador'] != current_user.id:
            return jsonify({'success': False, 'message': 'Acción no autorizada.'}), 403
        resultado = controlador_cuestionario.eliminar_cuestionario_por_id(id_cuestionario)
        if resultado > 0:
            return jsonify({'success': True, 'message': 'Cuestionario eliminado permanentemente.'})
        return jsonify({'success': False, 'message': 'No se pudo eliminar.'}), 404
    except Exception as e:
        app.logger.error(f"Error al eliminar permanentemente: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno'}), 500


# --- NUEVA RUTA PARA SUBIR IMÁGENES ---
@app.route('/api/upload/image', methods=['POST'])
@login_required # Asegura que solo usuarios logueados suban
def upload_image():
    if current_user.rol != 'profesor': # O ajusta según tus roles
         return jsonify({'success': False, 'message': 'No autorizado'}), 403

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No se encontró el archivo'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'success': False, 'message': 'No se seleccionó ningún archivo'}), 400

    if file and allowed_file(file.filename):
        # Crear un nombre de archivo seguro y único
        filename = secure_filename(file.filename)
        # Añadir timestamp o UUID para evitar colisiones (opcional pero recomendado)
        base, ext = os.path.splitext(filename)
        unique_filename = f"{base}_{secrets.token_hex(8)}{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)

        try:
            file.save(filepath)
            # Devolver la URL relativa que el frontend puede usar
            image_url = url_for('static', filename=f'uploads/images/{unique_filename}')
            return jsonify({'success': True, 'url': image_url})
        except Exception as e:
            app.logger.error(f"Error al guardar archivo: {e}")
            return jsonify({'success': False, 'message': 'Error al guardar el archivo'}), 500
    else:
        return jsonify({'success': False, 'message': 'Tipo de archivo no permitido'}), 400


@app.route('/api/partida/<string:pin>/podio')
@login_required # Opcional, dependiendo de si el ranking es público
def api_obtener_podio(pin):
    """
    API endpoint para obtener el podio (Top 3) de una partida.
    """
    try:
        # 1. Encontrar la partida usando el PIN
        partida = controlador_cuestionario.obtener_partida_por_pin(pin)
        if not partida:
            return jsonify({'error': 'Partida no encontrada'}), 404

        # 2. Obtener el podio usando el id_partida
        id_partida = partida['id_partida']
        podio = controlador_cuestionario.obtener_podio_por_partida(id_partida)

        # 3. Rellenar con "N/A" si hay menos de 3 jugadores
        while len(podio) < 3:
            podio.append({'nombre_usuario_partida': '-', 'puntaje_total': 0})

        return jsonify(podio)

    except Exception as e:
        app.logger.error(f"Error al obtener podio API: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500


# ===============================================================
# APIs DE USUARIO (CRUD) PARA POSTMAN
# ===============================================================
# ===============================================================
# API: Registrar usuario
# POST /api/usuario
# ===============================================================
@app.route('/api/usuario', methods=['POST'])
def api_registrar_usuario():
    try:
        data = request.get_json()

        required = ['nombres', 'apellidos', 'username', 'email', 'password', 'rol']
        if not all(k in data for k in required):
            return jsonify({"success": False, "error": "Faltan datos"}), 400

        # Encriptar contraseña
        password_hash = encriptar_sha256(data['password'])

        # Verificar duplicados
        if controlador_user.verificar_existencia_usuario(data['email'], data['username']):
            return jsonify({"success": False, "error": "Email o username ya existen"}), 409

        controlador_user.crear_usuario(
            data['nombres'],
            data['apellidos'],
            data['username'],
            data['email'],
            password_hash,
            data['rol'],
            is_verified=True  # Por defecto aquí (POSTMAN no validará email)
        )

        return jsonify({"success": True, "message": "Usuario registrado"}), 201

    except Exception as e:
        app.logger.error(f"Error en api_registrar_usuario: {e}")
        return jsonify({"success": False, "error": "Error interno del servidor"}), 500


# ===============================================================
# API: Actualizar usuario
# PUT /api/usuario/<id>
# ===============================================================
@app.route('/api/usuario/<int:id_usuario>', methods=['PUT'])
def api_actualizar_usuario(id_usuario):
    try:
        data = request.get_json()

        usuario = controlador_user.obtener_usuario_por_id(id_usuario)
        if not usuario:
            return jsonify({"success": False, "error": "Usuario no encontrado"}), 404

        controlador_user.actualizar_usuario(
            id_usuario,
            data.get('nombres', usuario['nombres']),
            data.get('apellidos', usuario['apellidos']),
            data.get('username', usuario['username']),
            data.get('email', usuario['email']),
            data.get('rol', usuario['rol'])
        )

        return jsonify({"success": True, "message": "Usuario actualizado"}), 200

    except Exception as e:
        app.logger.error(f"Error en api_actualizar_usuario: {e}")
        return jsonify({"success": False, "error": "Error interno"}), 500



# ===============================================================
# API: Obtener usuario por ID
# GET /api/usuario/<id>
# ===============================================================
@app.route('/api/usuario/<int:id_usuario>', methods=['GET'])
def api_obtener_usuario_id(id_usuario):
    try:
        usuario = controlador_user.obtener_usuario_por_id(id_usuario)

        if not usuario:
            return jsonify({"success": False, "error": "Usuario no encontrado"}), 404

        return jsonify({"success": True, "data": usuario}), 200

    except Exception as e:
        app.logger.error(f"Error en api_obtener_usuario_id: {e}")
        return jsonify({"success": False, "error": "Error interno"}), 500



# ===============================================================
# API: Obtener todos los usuarios
# GET /api/usuarios
# ===============================================================
@app.route('/api/usuarios', methods=['GET'])
def api_obtener_usuarios():
    try:
        usuarios = controlador_user.obtener_todos_los_usuarios()
        return jsonify({"success": True, "data": usuarios}), 200

    except Exception as e:
        app.logger.error(f"Error en api_obtener_usuarios: {e}")
        return jsonify({"success": False, "error": "Error interno"}), 500



# ===============================================================
# API: Eliminar usuario (baja lógica)
# DELETE /api/usuario/<id>
# ===============================================================
@app.route('/api/usuario/<int:id_usuario>', methods=['DELETE'])
def api_eliminar_usuario(id_usuario):
    try:
        usuario = controlador_user.obtener_usuario_por_id(id_usuario)
        if not usuario:
            return jsonify({"success": False, "error": "Usuario no encontrado"}), 404

        controlador_user.cambiar_estado_usuario(id_usuario, "Inactivo")

        return jsonify({"success": True, "message": "Usuario desactivado"}), 200

    except Exception as e:
        app.logger.error(f"Error en api_eliminar_usuario: {e}")
        return jsonify({"success": False, "error": "Error interno"}), 500


# # ===============================================================
# # API: REGISTRAR/CREAR PARTIDA
# # POST /api/partida
# # Requiere: JSON con id_cuestionario, modo_juego (opcional)
# # ===============================================================
# @app.route('/api/partida', methods=['POST'])
# @login_required
# def api_registrar_partida():
#     """
#     Crea una nueva partida para un cuestionario.
#     Solo profesores pueden crear partidas de sus cuestionarios.
#     """
#     if current_user.rol != 'profesor':
#         return jsonify({"success": False, "error": "Solo profesores pueden crear partidas"}), 403

#     try:
#         data = request.get_json()

#         # Validar datos
#         if not data or 'id_cuestionario' not in data:
#             return jsonify({"success": False, "error": "id_cuestionario es obligatorio"}), 400

#         id_cuestionario = data.get('id_cuestionario')
#         modo_juego = data.get('modo_juego', 'individual')

#         # Validar que el cuestionario existe y pertenece al profesor
#         cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
#         if not cuestionario:
#             return jsonify({"success": False, "error": "Cuestionario no encontrado"}), 404

#         if cuestionario.get('id_profesor_creador') != current_user.id:
#             return jsonify({"success": False, "error": "No tienes permiso sobre este cuestionario"}), 403

#         # Validar modo de juego
#         if modo_juego not in ['individual', 'grupo']:
#             return jsonify({"success": False, "error": "modo_juego debe ser 'individual' o 'grupo'"}), 400

#         # Generar PIN único
#         caracteres_pin = string.ascii_uppercase + string.digits
#         pin_generado = None
#         for _ in range(100):
#             posible_pin = ''.join(secrets.choice(caracteres_pin) for _ in range(6))
#             # Verificar si ya existe
#             if not controlador_cuestionario.existe_pin_en_cuestionario(posible_pin) and \
#               not controlador_cuestionario.obtener_partida_por_pin(posible_pin):
#                 pin_generado = posible_pin
#                 break

#         if not pin_generado:
#             return jsonify({"success": False, "error": "No se pudo generar un PIN único"}), 500

#         # Crear la partida (la función crear_partida necesita ser actualizada)
#         id_partida = controlador_cuestionario.crear_partida(
#             id_cuestionario=id_cuestionario,
#             pin=pin_generado,
#             estado='esperando',
#             modo_juego=modo_juego  # ← AÑADIDO
#         )

#         if not id_partida:
#             return jsonify({"success": False, "error": "Error al crear la partida en la BD"}), 500

#         return jsonify({
#             "success": True,
#             "message": "Partida creada exitosamente",
#             "id_partida": id_partida,
#             "pin": pin_generado,
#             "estado": "esperando",
#             "modo_juego": modo_juego,
#             "fecha_inicio": None
#         }), 201

#     except Exception as e:
#         app.logger.error(f"Error en api_registrar_partida: {e}", exc_info=True)
#         return jsonify({"success": False, "error": "Error interno del servidor"}), 500

@app.route('/api/partida', methods=['POST'])
@login_required
def api_registrar_partida():
    """
    VERSIÓN MEJORADA: Usa pin_permanente como el flujo web
    """
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Solo profesores"}), 403

    try:
        data = request.get_json()
        id_cuestionario = data.get('id_cuestionario')
        modo_juego = data.get('modo_juego', 'individual')

        # Validar cuestionario
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario:
            return jsonify({"success": False, "error": "Cuestionario no encontrado"}), 404

        if cuestionario.get('id_profesor_creador') != current_user.id:
            return jsonify({"success": False, "error": "No tienes permiso"}), 403

        # 🔑 USAR PIN PERMANENTE (como el flujo web)
        pin_a_usar = cuestionario.get('pin_permanente')

        # Si no tiene pin_permanente, generar uno
        if not pin_a_usar:
            caracteres_pin = string.ascii_uppercase + string.digits
            for _ in range(100):
                posible_pin = ''.join(secrets.choice(caracteres_pin) for _ in range(6))
                if not controlador_cuestionario.existe_pin_en_cuestionario(posible_pin) and \
                   not controlador_cuestionario.obtener_partida_por_pin(posible_pin):
                    pin_a_usar = posible_pin
                    break

            if not pin_a_usar:
                return jsonify({"success": False, "error": "No se pudo generar PIN"}), 500

            # Guardar el PIN permanente en el cuestionario
            controlador_cuestionario.guardar_pin_permanente(id_cuestionario, pin_a_usar)

        # Buscar si ya existe una partida con este PIN
        partida_existente = controlador_cuestionario.obtener_partida_por_pin(pin_a_usar)

        if partida_existente:
            id_partida = partida_existente['id_partida']

            # Limpiar participantes anteriores
            conexion = obtener_conexion()
            with conexion.cursor() as cursor:
                cursor.execute("""
                    UPDATE Participante
                    SET estado = 'Inactivo'
                    WHERE id_partida = %s AND estado = 'Activo'
                """, (id_partida,))
                conexion.commit()

            # Reactivar la partida
            controlador_cuestionario.actualizar_estado_partida(id_partida, 'esperando')

            return jsonify({
                "success": True,
                "message": "Partida reactivada (PIN permanente)",
                "id_partida": id_partida,
                "pin": pin_a_usar,
                "estado": "esperando",
                "modo_juego": modo_juego,
                "es_reutilizada": True
            }), 200

        else:
            # Crear nueva partida con el PIN permanente
            id_partida = controlador_cuestionario.crear_partida(
                id_cuestionario=id_cuestionario,
                pin=pin_a_usar,
                estado='esperando',
                modo_juego=modo_juego
            )

            if not id_partida:
                return jsonify({"success": False, "error": "Error al crear partida"}), 500

            return jsonify({
                "success": True,
                "message": "Partida creada con PIN permanente",
                "id_partida": id_partida,
                "pin": pin_a_usar,
                "estado": "esperando",
                "modo_juego": modo_juego,
                "es_reutilizada": False
            }), 201

    except Exception as e:
        app.logger.error(f"Error en api_registrar_partida: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno"}), 500

# ===============================================================
# API: OBTENER PARTIDA POR ID
# GET /api/partida/<id_partida>
# Retorna los datos de una partida específica
# ===============================================================
@app.route('/api/partida/<int:id_partida>', methods=['GET'])
@login_required
def api_obtener_partida_id(id_partida):
    """
    Obtiene los datos de una partida específica.
    Valida que el usuario sea el profesor propietario del cuestionario.
    """
    conexion = None  # ← Inicializar ANTES del try
    try:
        conexion = obtener_conexion()

        if not conexion:
            app.logger.error("No se pudo obtener conexión a la base de datos")
            return jsonify({"success": False, "error": "Error de conexión a la base de datos"}), 500

        with conexion.cursor() as cursor:
            cursor.execute("""
                SELECT p.id_partida, p.id_cuestionario, p.pin_acceso, p.fecha_inicio,
                       p.fecha_fin, p.estado, p.modo_juego, p.fase, p.pregunta_actual_orden,
                       c.titulo AS titulo_cuestionario, c.id_profesor_creador
                FROM Partida p
                JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                WHERE p.id_partida = %s
            """, (id_partida,))

            partida = cursor.fetchone()

            if not partida:
                return jsonify({"success": False, "error": "Partida no encontrada"}), 404

            # Validar permiso: solo el profesor propietario del cuestionario
            if partida['id_profesor_creador'] != current_user.id:
                return jsonify({"success": False, "error": "No tienes permiso para ver esta partida"}), 403

            # Obtener participantes activos
            cursor.execute("""
                SELECT COUNT(*) AS total_participantes
                FROM Participante
                WHERE id_partida = %s AND estado = 'Activo'
            """, (id_partida,))

            conteo = cursor.fetchone()
            total_participantes = conteo['total_participantes'] if conteo else 0

            return jsonify({
                "success": True,
                "data": {
                    "id_partida": partida['id_partida'],
                    "id_cuestionario": partida['id_cuestionario'],
                    "titulo_cuestionario": partida['titulo_cuestionario'],
                    "pin": partida['pin_acceso'],
                    "estado": partida['estado'],
                    "modo_juego": partida['modo_juego'],
                    "fase": partida['fase'],
                    "pregunta_actual_orden": partida['pregunta_actual_orden'],
                    "fecha_inicio": str(partida['fecha_inicio']) if partida['fecha_inicio'] else None,
                    "fecha_fin": str(partida['fecha_fin']) if partida['fecha_fin'] else None,
                    "total_participantes": total_participantes
                }
            }), 200

    except Exception as e:
        app.logger.error(f"Error en api_obtener_partida_id: {e}", exc_info=True)
        return jsonify({"success": False, "error": f"Error interno del servidor: {str(e)}"}), 500

    finally:
        if conexion:
            conexion.close()


# ===============================================================
# API: OBTENER TODAS LAS PARTIDAS DEL PROFESOR
# GET /api/partidas
# Retorna lista de partidas del profesor autenticado
# Filtrado opcional: ?estado=esperando&modo=individual
# ===============================================================
@app.route('/api/partidas', methods=['GET'])
@login_required
def api_obtener_partidas():
    """
    Obtiene todas las partidas de los cuestionarios del profesor.
    Parámetros de filtro opcionales:
    - estado: 'esperando', 'en_curso', 'finalizada'
    - modo: 'individual', 'grupo'

    Ejemplo: GET /api/partidas?estado=en_curso&modo=individual
    """
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Solo profesores pueden acceder"}), 403

    try:
        estado_filtro = request.args.get('estado')  # Opcional
        modo_filtro = request.args.get('modo')      # Opcional

        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # Construir query dinámicamente
            query = """
                SELECT p.id_partida, p.id_cuestionario, p.pin_acceso, p.fecha_inicio,
                       p.fecha_fin, p.estado, p.modo_juego, p.fase, p.pregunta_actual_orden,
                       p.pregunta_actual_index, c.titulo AS titulo_cuestionario,
                       COUNT(pp.id_participante) AS total_participantes
                FROM Partida p
                JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                LEFT JOIN Participante pp ON p.id_partida = pp.id_partida AND pp.estado = 'Activo'
                WHERE c.id_profesor_creador = %s
            """

            params = [current_user.id]

            if estado_filtro:
                query += " AND p.estado = %s"
                params.append(estado_filtro)

            if modo_filtro:
                query += " AND p.modo_juego = %s"
                params.append(modo_filtro)

            query += " GROUP BY p.id_partida ORDER BY p.fecha_inicio DESC"

            cursor.execute(query, params)
            partidas = cursor.fetchall()

            partidas_list = []
            for partida in partidas:
                partidas_list.append({
                    "id_partida": partida['id_partida'],
                    "id_cuestionario": partida['id_cuestionario'],
                    "titulo_cuestionario": partida['titulo_cuestionario'],
                    "pin": partida['pin_acceso'],
                    "estado": partida['estado'],
                    "modo_juego": partida['modo_juego'],
                    "fase": partida['fase'],
                    "pregunta_actual_orden": partida['pregunta_actual_orden'],
                    "fecha_inicio": str(partida['fecha_inicio']) if partida['fecha_inicio'] else None,
                    "fecha_fin": str(partida['fecha_fin']) if partida['fecha_fin'] else None,
                    "total_participantes": partida['total_participantes']
                })

            return jsonify({
                "success": True,
                "total": len(partidas_list),
                "data": partidas_list
            }), 200

    except Exception as e:
        app.logger.error(f"Error en api_obtener_partidas: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno"}), 500
    finally:
        if conexion:
            conexion.close()


# ===============================================================
# API: ACTUALIZAR PARTIDA
# PUT /api/partida/<id_partida>
# Permite cambiar estado, fase, modo_juego, tiempo_limite
# ===============================================================
@app.route('/api/partida/<int:id_partida>', methods=['PUT'])
@login_required
def api_actualizar_partida(id_partida):
    """
    Actualiza los datos de una partida.
    Campos permitidos: estado, modo_juego, fase, tiempo_limite

    Body JSON:
    {
        "estado": "en_curso",
        "fase": "pregunta",
        "modo_juego": "grupo",
        "tiempo_limite": 30
    }
    """
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Solo profesores pueden actualizar"}), 403

    try:
        data = request.get_json()

        if not data:
            return jsonify({"success": False, "error": "No se recibieron datos"}), 400

        # Validar que la partida existe y pertenece al profesor
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            cursor.execute("""
                SELECT p.id_partida, c.id_profesor_creador
                FROM Partida p
                JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                WHERE p.id_partida = %s
            """, (id_partida,))

            partida = cursor.fetchone()
            if not partida:
                return jsonify({"success": False, "error": "Partida no encontrada"}), 404

            if partida['id_profesor_creador'] != current_user.id:
                return jsonify({"success": False, "error": "No tienes permiso"}), 403

            # Construir UPDATE dinámico
            campos_actualizables = {
                'estado': ['esperando', 'en_curso', 'finalizada'],
                'modo_juego': ['individual', 'grupo'],
                'fase': ['esperando', 'pregunta', 'resultado', 'finalizado'],
                'tiempo_limite': None  # Acepta cualquier int
            }

            campos_a_actualizar = []
            valores = []

            for campo, valores_validos in campos_actualizables.items():
                if campo in data:
                    valor = data[campo]

                    # Validar valores específicos si hay restricción
                    if valores_validos is not None:
                        if valor not in valores_validos:
                            return jsonify({
                                "success": False,
                                "error": f"{campo} inválido. Valores permitidos: {', '.join(valores_validos)}"
                            }), 400

                    # Validar tipo para tiempo_limite
                    if campo == 'tiempo_limite':
                        try:
                            valor = int(valor)
                            if valor < 0:
                                return jsonify({"success": False, "error": "tiempo_limite no puede ser negativo"}), 400
                        except (ValueError, TypeError):
                            return jsonify({"success": False, "error": "tiempo_limite debe ser un número entero"}), 400

                    campos_a_actualizar.append(f"{campo} = %s")
                    valores.append(valor)

            if not campos_a_actualizar:
                return jsonify({"success": False, "error": "No hay campos para actualizar"}), 400

            # Ejecutar UPDATE
            valores.append(id_partida)
            query = f"UPDATE Partida SET {', '.join(campos_a_actualizar)} WHERE id_partida = %s"
            cursor.execute(query, valores)
            conexion.commit()

            return jsonify({
                "success": True,
                "message": "Partida actualizada exitosamente",
                "id_partida": id_partida
            }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        app.logger.error(f"Error en api_actualizar_partida: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno"}), 500
    finally:
        if conexion:
            conexion.close()


# ===============================================================
# API: ELIMINAR PARTIDA (BAJA LÓGICA)
# DELETE /api/partida/<id_partida>
# Marca la partida como finalizada y desactiva participantes
# ===============================================================
@app.route('/api/partida/<int:id_partida>', methods=['DELETE'])
@login_required
def api_eliminar_partida(id_partida):
    """
    Realiza una baja lógica de la partida.
    - Marca estado como 'finalizada'
    - Marca fase como 'finalizado'
    - Desactiva todos los participantes
    - Se puede reactivar luego si es necesario
    """
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Solo profesores pueden eliminar"}), 403

    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # Validar propiedad
            cursor.execute("""
                SELECT p.id_partida, p.pin_acceso, c.id_profesor_creador
                FROM Partida p
                JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                WHERE p.id_partida = %s
            """, (id_partida,))

            partida = cursor.fetchone()
            if not partida:
                return jsonify({"success": False, "error": "Partida no encontrada"}), 404

            if partida['id_profesor_creador'] != current_user.id:
                return jsonify({"success": False, "error": "No tienes permiso"}), 403

            # Desactivar participantes
            cursor.execute("""
                UPDATE Participante
                SET estado = 'Inactivo'
                WHERE id_partida = %s AND estado = 'Activo'
            """, (id_partida,))

            # Marcar partida como finalizada
            cursor.execute("""
                UPDATE Partida
                SET estado = 'finalizada', fase = 'finalizado', fecha_fin = NOW()
                WHERE id_partida = %s
            """, (id_partida,))

            conexion.commit()

            # Notificar a alumnos conectados via long polling
            pin = partida['pin_acceso']
            if pin in partida_events:
                partida_events[pin].set()

            app.logger.info(f"Partida {id_partida} (PIN: {pin}) eliminada por profesor {current_user.id}")

            return jsonify({
                "success": True,
                "message": "Partida eliminada (finalizada)",
                "id_partida": id_partida,
                "pin": pin
            }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        app.logger.error(f"Error en api_eliminar_partida: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno"}), 500
    finally:
        if conexion:
            conexion.close()



@app.route('/api/cuestionario/<int:id_cuestionario>/pregunta', methods=['POST'])
@login_required
def api_registrar_pregunta(id_cuestionario):
    """
    1. REGISTRAR ENTIDAD (Pregunta)
    Llama a: ctrl_pregunta.crear_pregunta_completa
    """
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403
    try:
        # Verificar que el profesor es dueño del cuestionario
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario or cuestionario.get('id_profesor_creador') != current_user.id:
            return jsonify({'error': 'No tienes permiso sobre este cuestionario'}), 403

        datos_pregunta = request.get_json()
        if not datos_pregunta:
            return jsonify({'error': 'No se recibieron datos (JSON body vacío)'}), 400

        # Llama a la NUEVA función completa
        nueva_pregunta = controlador_pregunta.crear_pregunta_completa(id_cuestionario, datos_pregunta)

        if not nueva_pregunta:
             return jsonify({'error': 'No se pudo crear la pregunta'}), 500

        return jsonify(nueva_pregunta), 201 # 201 = Created

    except Exception as e:
        app.logger.error(f"Error al registrar pregunta: {e}", exc_info=True)
        return jsonify({'error': 'Error interno al crear la pregunta'}), 500

# ---

@app.route('/api/pregunta/<int:id_pregunta>/actualizar', methods=['PUT'])
@login_required
def api_actualizar_pregunta(id_pregunta):
    """
    2. ACTUALIZAR ENTIDAD (Pregunta)
    Llama a: ctrl_pregunta.actualizar_pregunta_completa
    """
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403
    try:
        datos_actualizados = request.get_json()
        if not datos_actualizados:
            return jsonify({'error': 'No se recibieron datos (JSON body vacío)'}), 400

        # Llama a la NUEVA función completa (ya incluye seguridad)
        pregunta_actualizada = controlador_pregunta.actualizar_pregunta_completa(
            id_pregunta, current_user.id, datos_actualizados
        )

        if not pregunta_actualizada:
            return jsonify({'error': 'Pregunta no encontrada o no tienes permiso'}), 404

        return jsonify(pregunta_actualizada)

    except Exception as e:
        app.logger.error(f"Error al actualizar pregunta {id_pregunta}: {e}", exc_info=True)
        return jsonify({'error': 'Error interno al actualizar'}), 500

# ---

@app.route('/api/pregunta/<int:id_pregunta>/obtener', methods=['GET'])
@login_required
def api_obtener_pregunta_id(id_pregunta):
    """
    3. OBTENER ENTIDAD POR ID (Pregunta)
    Llama a: ctrl_pregunta.obtener_pregunta_completa_por_id
    """
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403
    try:
        # Llama a la NUEVA función que te faltaba (ya incluye seguridad)
        pregunta = controlador_pregunta.obtener_pregunta_completa_por_id(id_pregunta, current_user.id)

        if not pregunta:
            return jsonify({'error': 'Pregunta no encontrada o no tienes permiso'}), 404

        return jsonify(pregunta)

    except Exception as e:
        app.logger.error(f"Error al obtener pregunta {id_pregunta}: {e}", exc_info=True)
        return jsonify({'error': 'Error interno'}), 500

# ---

@app.route('/api/cuestionario/<int:id_cuestionario>/preguntas', methods=['GET'])
@login_required
def api_obtener_preguntas_por_cuestionario(id_cuestionario):
    """
    4. OBTENER ENTIDADES (Lista de Preguntas)
    Llama a: ctrl_pregunta.obtener_preguntas_completas_por_cuestionario
    """
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403
    try:
        # Verificar que el profesor es dueño del cuestionario
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario or cuestionario.get('id_profesor_creador') != current_user.id:
            return jsonify({'error': 'No tienes permiso sobre este cuestionario'}), 403

        # Llama a la función que SÍ tenías en tu controlador original
        lista_preguntas = controlador_pregunta.obtener_preguntas_completas_por_cuestionario(id_cuestionario)

        return jsonify(lista_preguntas)

    except Exception as e:
        app.logger.error(f"Error al obtener preguntas del cuestionario {id_cuestionario}: {e}", exc_info=True)
        return jsonify({'error': 'Error interno'}), 500

# ---

@app.route('/api/pregunta/<int:id_pregunta>/eliminar', methods=['DELETE'])
@login_required
def api_eliminar_pregunta(id_pregunta):
    """
    5. ELIMINAR ENTIDAD (Pregunta)
    Llama a: ctrl_pregunta.eliminar_pregunta_con_seguridad
    """
    if current_user.rol != 'profesor':
        return jsonify({'error': 'Acceso no autorizado'}), 403
    try:
        # Llama a la NUEVA función de borrado seguro
        filas_afectadas = controlador_pregunta.eliminar_pregunta_con_seguridad(id_pregunta, current_user.id)

        if filas_afectadas > 0:
            return jsonify({'success': True, 'message': 'Pregunta eliminada'})
        else:
            return jsonify({'error': 'Pregunta no encontrada o no tienes permiso'}), 404

    except Exception as e:
        app.logger.error(f"Error al eliminar pregunta {id_pregunta}: {e}", exc_info=True)
        return jsonify({'error': 'Error interno al eliminar'}), 500


# ============================================================
# APIs CRUD para RespuestaParticipante
# ============================================================
@app.route("/api/respuestaParticipante", methods=["POST"])
@login_required
def api_registrar_respuesta_participante():
    data = request.get_json()
    nuevo_id = controladorRespuestaParticipante.registrar_respuesta_participante(
        data["id_participante"],
        data["id_pregunta"],
        data["id_respuesta_seleccionada"],
        data["tiempo_respuesta_segundos"],
        data["puntuacion_obtenida"]
    )
    return jsonify({"success": True, "id": nuevo_id}), 201


@app.route("/api/respuestaParticipante/<int:id>", methods=["PUT"])
@login_required
def api_actualizar_respuesta_participante(id):
    data = request.get_json()
    filas = controladorRespuestaParticipante.actualizar_respuesta_participante(
        id,
        data["id_respuesta_seleccionada"],
        data["tiempo_respuesta_segundos"],
        data["puntuacion_obtenida"]
    )
    return jsonify({"success": filas > 0})


@app.route("/api/respuestaParticipante/<int:id>", methods=["GET"])
@login_required
def api_obtener_respuesta_participante_id(id):
    respuesta = controladorRespuestaParticipante.obtener_respuesta_participante_por_id(id)
    return jsonify(respuesta)


@app.route("/api/respuestaParticipante", methods=["GET"])
@login_required
def api_obtener_respuestas_participante():
    respuestas = controladorRespuestaParticipante.obtener_respuestas_participante()
    return jsonify(respuestas)


@app.route("/api/respuestaParticipante/<int:id>", methods=["DELETE"])
@login_required
def api_eliminar_respuesta_participante(id):
    filas = controladorRespuestaParticipante.eliminar_respuesta_participante(id)
    return jsonify({"success": filas > 0})


# ========================================================
# CRUD RESPUESTA (PÉGALO AQUÍ)
# ========================================================
@app.route('/api/respuesta', methods=['POST'])
@login_required
def api_registrar_respuesta():
    data = request.get_json()
    nuevo_id = controladorRespuesta.registrar_respuesta(
        data["id_pregunta"],
        data["texto_respuesta"],
        data["es_correcta"]
    )
    return jsonify({"success": True, "id": nuevo_id}), 201


@app.route('/api/respuesta/<int:id_respuesta>', methods=['PUT'])
@login_required
def api_actualizar_respuesta(id_respuesta):
    data = request.get_json()
    filas = controladorRespuesta.actualizar_respuesta(
        id_respuesta,
        data["texto_respuesta"],
        data["es_correcta"]
    )
    return jsonify({"success": filas > 0})


@app.route('/api/respuesta/<int:id_respuesta>', methods=['GET'])
@login_required
def api_obtener_respuesta_id(id_respuesta):
    respuesta = controladorRespuesta.obtener_respuesta_por_id(id_respuesta)
    return jsonify(respuesta)


@app.route('/api/respuesta', methods=['GET'])
@login_required
def api_obtener_respuestas_respuesta():
    respuestas = controladorRespuesta.obtener_respuestas()
    return jsonify(respuestas)


@app.route('/api/respuesta/<int:id_respuesta>', methods=['DELETE'])
@login_required
def api_eliminar_respuesta(id_respuesta):
    filas = controladorRespuesta.eliminar_respuesta(id_respuesta)
    return jsonify({"success": filas > 0})


# ===============================================================
# APIs CRUD PARA RECOMPENSA
# Seguridad: Flask-Login (@login_required)
# ===============================================================

# ===============================================================
# 1️⃣ API REGISTRAR RECOMPENSA (POST)
# ===============================================================
@app.route('/api/recompensa', methods=['POST'])
@login_required
def api_registrar_recompensa():
    """
    Crea una nueva recompensa para un cuestionario.
    """
    # ⚠️ Validar que el usuario es PROFESOR
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Solo profesores pueden crear recompensas"}), 403

    try:
        # 1. Obtener datos del JSON enviado
        data = request.get_json()

        # 2. Validar que los campos obligatorios estén presentes
        if not data or 'id_cuestionario' not in data or 'descripcion' not in data:
            return jsonify({"success": False, "error": "id_cuestionario y descripcion son obligatorios"}), 400

        id_cuestionario = data.get('id_cuestionario')

        # 3. Verificar que el profesor sea DUEÑO del cuestionario
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario or cuestionario.get('id_profesor_creador') != current_user.id:
            return jsonify({"success": False, "error": "No tienes permiso sobre este cuestionario"}), 403

        # 4. Importar controlador de recompensas
        import controladorRecompensa

        # 5. Llamar función para crear la recompensa
        nuevo_id = controladorRecompensa.crear_recompensa(
            id_cuestionario=id_cuestionario,
            descripcion=data.get('descripcion'),
            condicion=data.get('condicion'),  # OPCIONAL
            url_imagen=data.get('url_imagen')  # OPCIONAL
        )

        # 6. Validar que se creó correctamente
        if nuevo_id:
            return jsonify({
                "success": True,
                "message": "Recompensa creada exitosamente",
                "id_recompensa": nuevo_id
            }), 201
        else:
            return jsonify({"success": False, "error": "Error al crear la recompensa"}), 500

    except Exception as e:
        app.logger.error(f"Error en api_registrar_recompensa: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno del servidor"}), 500


# ===============================================================
# 2️⃣ API ACTUALIZAR RECOMPENSA (PUT)
# ===============================================================
@app.route('/api/recompensa/<int:id_recompensa>', methods=['PUT'])
@login_required
def api_actualizar_recompensa(id_recompensa):
    """
    Actualiza una recompensa existente.
    """
    # ⚠️ Validar que el usuario es PROFESOR
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Solo profesores pueden actualizar recompensas"}), 403

    try:
        # 1. Obtener datos del JSON
        data = request.get_json()

        # 2. Validar que se envió data
        if not data:
            return jsonify({"success": False, "error": "No se recibieron datos"}), 400

        # 3. Importar controlador
        import controladorRecompensa

        # 4. Verificar que el profesor sea DUEÑO de la recompensa
        if not controladorRecompensa.validar_propiedad_recompensa(id_recompensa, current_user.id):
            return jsonify({"success": False, "error": "No tienes permiso sobre esta recompensa"}), 403

        # 5. Actualizar la recompensa
        filas_afectadas = controladorRecompensa.actualizar_recompensa(
            id_recompensa=id_recompensa,
            nueva_descripcion=data.get('descripcion'),
            nueva_condicion=data.get('condicion'),
            nueva_url_imagen=data.get('url_imagen')
        )

        # 6. Validar si se actualizó algo
        if filas_afectadas > 0:
            return jsonify({
                "success": True,
                "message": "Recompensa actualizada exitosamente"
            }), 200
        else:
            return jsonify({"success": False, "error": "No se encontró la recompensa"}), 404

    except Exception as e:
        app.logger.error(f"Error en api_actualizar_recompensa: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno del servidor"}), 500


# ===============================================================
# 3️⃣ API OBTENER RECOMPENSA POR ID (GET)
# ===============================================================
@app.route('/api/recompensa/<int:id_recompensa>', methods=['GET'])
@login_required
def api_obtener_recompensa_id(id_recompensa):
    """
    Obtiene los datos de una recompensa específica por ID.
    """
    # ⚠️ Validar que el usuario es PROFESOR
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Acceso no autorizado"}), 403

    try:
        # 1. Importar controlador
        import controladorRecompensa

        # 2. Obtener recompensa CON validación de seguridad
        recompensa = controladorRecompensa.obtener_recompensa_por_id_con_seguridad(id_recompensa, current_user.id)

        # 3. Validar que existe y el profesor tiene permiso
        if not recompensa:
            return jsonify({"success": False, "error": "Recompensa no encontrada o sin permiso"}), 404

        # 4. Devolver los datos
        return jsonify({
            "success": True,
            "data": recompensa
        }), 200

    except Exception as e:
        app.logger.error(f"Error en api_obtener_recompensa_id: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno del servidor"}), 500


# ===============================================================
# 4️⃣ API LISTAR RECOMPENSAS DE UN CUESTIONARIO (GET)
# ===============================================================
@app.route('/api/cuestionario/<int:id_cuestionario>/recompensas', methods=['GET'])
@login_required
def api_obtener_recompensas(id_cuestionario):
    """
    Obtiene TODAS las recompensas de un cuestionario específico.
    """
    # ⚠️ Validar que el usuario es PROFESOR
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Acceso no autorizado"}), 403

    try:
        # 1. Verificar que el profesor es DUEÑO del cuestionario
        cuestionario = controlador_cuestionario.obtener_cuestionario_por_id(id_cuestionario)
        if not cuestionario or cuestionario.get('id_profesor_creador') != current_user.id:
            return jsonify({"success": False, "error": "No tienes permiso sobre este cuestionario"}), 403

        # 2. Importar controlador
        import controladorRecompensa

        # 3. Obtener todas las recompensas del cuestionario
        recompensas = controladorRecompensa.obtener_recompensas_por_cuestionario(id_cuestionario)

        # 4. Devolver la lista
        return jsonify({
            "success": True,
            "total": len(recompensas),
            "data": recompensas
        }), 200

    except Exception as e:
        app.logger.error(f"Error en api_obtener_recompensas: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno del servidor"}), 500


# ===============================================================
# 5️⃣ API ELIMINAR RECOMPENSA (DELETE)
# ===============================================================
@app.route('/api/recompensa/<int:id_recompensa>', methods=['DELETE'])
@login_required
def api_eliminar_recompensa(id_recompensa):
    """
    Elimina permanentemente una recompensa.
    """
    # ⚠️ Validar que el usuario es PROFESOR
    if current_user.rol != 'profesor':
        return jsonify({"success": False, "error": "Solo profesores pueden eliminar recompensas"}), 403

    try:
        # 1. Importar controlador
        import controladorRecompensa

        # 2. Verificar que el profesor es DUEÑO de la recompensa
        if not controladorRecompensa.validar_propiedad_recompensa(id_recompensa, current_user.id):
            return jsonify({"success": False, "error": "No tienes permiso sobre esta recompensa"}), 403

        # 3. Eliminar la recompensa
        filas_afectadas = controladorRecompensa.eliminar_recompensa(id_recompensa)

        # 4. Validar si se eliminó
        if filas_afectadas > 0:
            return jsonify({
                "success": True,
                "message": "Recompensa eliminada exitosamente"
            }), 200
        else:
            return jsonify({"success": False, "error": "No se encontró la recompensa"}), 404

    except Exception as e:
        app.logger.error(f"Error en api_eliminar_recompensa: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Error interno del servidor"}), 500

@app.errorhandler(404)
def page_not_found(e):
    return render_template('errorsistema.html', error_code=404, error_message="Página no encontrada"), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('errorsistema.html', error_code=500, error_message="Error interno del servidor"), 500

@app.errorhandler(403)
def forbidden_error(e):
    return render_template('errorsistema.html', error_code=403, error_message="No tienes permiso para acceder a esta página"), 403

if __name__ == '__main__':
    app.run(threaded=True)