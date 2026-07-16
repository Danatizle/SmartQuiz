from conexionBD import obtener_conexion


# ==============================
#  CREAR USUARIO
# ==============================
def crear_usuario(nombres, apellidos, username, email, password_hash, rol, verification_code=None, is_verified=False):
    """Inserta un nuevo usuario en la base de datos."""
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            # Asegúrate de que tu tabla Usuario tenga estas columnas
            sql = """
                INSERT INTO Usuario
                (nombres, apellidos, username, email, password_hash, rol, is_verified, verification_code, estado)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Activo')
            """
            cursor.execute(
                sql,
                (nombres, apellidos, username, email, password_hash, rol,
                 1 if is_verified else 0, verification_code)
            )
        conexion.commit()
    finally:
        if conexion:
            conexion.close()


# ==============================
#  OBTENER USUARIO
# ==============================
def obtener_usuario_por_identificador(identifier):
    """Busca un usuario por su email o username, solo si su estado es 'Activo'."""
    conexion = obtener_conexion()
    usuario = None
    try:
        with conexion.cursor() as cursor:
            sql = """
                SELECT id_usuario, nombres, apellidos, username, email, rol, password_hash, is_verified
                FROM Usuario
                WHERE (email = %s OR username = %s) AND estado = 'Activo'
            """
            cursor.execute(sql, (identifier, identifier))
            usuario = cursor.fetchone()
    finally:
        if conexion:
            conexion.close()
    return usuario


def obtener_usuario_por_id(id_usuario):
    """
    Obtiene todos los datos de un usuario, incluyendo el hash de la contraseña.
    """
    conexion = obtener_conexion()
    usuario = None
    try:
        with conexion.cursor() as cursor:
            # Añadimos password_hash a la consulta
            sql = """
                SELECT id_usuario, nombres, apellidos, username, email, rol, estado, is_verified, password_hash
                FROM Usuario
                WHERE id_usuario = %s
            """
            cursor.execute(sql, (id_usuario,))
            usuario = cursor.fetchone()
    finally:
        if conexion:
            conexion.close()
    return usuario


def obtener_todos_los_usuarios():
    """Obtiene una lista de todos los usuarios para la vista del administrador."""
    conexion = obtener_conexion()
    usuarios = []
    try:
        with conexion.cursor() as cursor:
            cursor.execute("""
                SELECT id_usuario, nombres, apellidos, username, email, rol, estado
                FROM Usuario
            """)
            usuarios = cursor.fetchall()
    finally:
        if conexion:
            conexion.close()
    return usuarios


# ==============================
#  VERIFICACIONES Y EXISTENCIA
# ==============================
def verificar_existencia_usuario(email, username):
    """Verifica si un email o username ya existen."""
    conexion = obtener_conexion()
    usuario_existente = None
    try:
        with conexion.cursor() as cursor:
            sql = "SELECT id_usuario FROM Usuario WHERE email = %s OR username = %s"
            cursor.execute(sql, (email, username))
            usuario_existente = cursor.fetchone()
    finally:
        if conexion:
            conexion.close()
    return usuario_existente is not None


def obtener_usuario_por_email(email):
    """Busca un usuario por su email."""
    conexion = obtener_conexion()
    usuario = None
    try:
        with conexion.cursor() as cursor:
            sql = "SELECT * FROM Usuario WHERE email = %s"
            cursor.execute(sql, (email,))
            usuario = cursor.fetchone()
    finally:
        if conexion:
            conexion.close()
    return usuario


# ==============================
#  ACTUALIZAR DATOS
# ==============================
def actualizar_usuario(id_usuario, nombres, apellidos, username, email, rol):
    """Actualiza los datos de un usuario existente."""
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = """
                UPDATE Usuario
                SET nombres = %s, apellidos = %s, username = %s, email = %s, rol = %s
                WHERE id_usuario = %s
            """
            cursor.execute(sql, (nombres, apellidos, username, email, rol, id_usuario))
        conexion.commit()
    finally:
        if conexion:
            conexion.close()


def cambiar_estado_usuario(id_usuario, nuevo_estado):
    """Actualiza el estado de un usuario a 'Activo' o 'Inactivo'."""
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = "UPDATE Usuario SET estado = %s WHERE id_usuario = %s"
            cursor.execute(sql, (nuevo_estado, id_usuario))
        conexion.commit()
    finally:
        if conexion:
            conexion.close()


# ==============================
#  FUNCIONES DE VERIFICACIÓN
# ==============================
def verificar_usuario(email):
    """Marca un usuario como verificado y limpia el código."""
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = "UPDATE Usuario SET is_verified = 1, verification_code = NULL WHERE email = %s"
            cursor.execute(sql, (email,))
        conexion.commit()
    finally:
        if conexion:
            conexion.close()


def guardar_codigo_recuperacion(email, codigo):
    """Guarda un código de recuperación para el usuario."""
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = "UPDATE Usuario SET verification_code = %s WHERE email = %s"
            cursor.execute(sql, (codigo, email))
        conexion.commit()
    finally:
        if conexion:
            conexion.close()


def cambiar_contrasena(email, nuevo_password_hash):
    """Actualiza la contraseña y limpia el código de recuperación."""
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = "UPDATE Usuario SET password_hash = %s, verification_code = NULL WHERE email = %s"
            cursor.execute(sql, (nuevo_password_hash, email))
        conexion.commit()
    finally:
        if conexion:
            conexion.close()

# AÑADE ESTAS DOS FUNCIONES A controladorUsuario.py

def actualizar_datos_perfil(id_usuario, nombres, apellidos, username): # <--- 1. Añade username aquí
    """
    Actualiza los nombres, apellidos y username de un usuario en la base de datos.
    """
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            # 2. Añade username = %s a la consulta SQL
            sql = "UPDATE Usuario SET nombres = %s, apellidos = %s, username = %s WHERE id_usuario = %s"
            # 3. Añade la variable username a la ejecución
            cursor.execute(sql, (nombres, apellidos, username, id_usuario))
        conexion.commit()
        return cursor.rowcount
    finally:
        if conexion:
            conexion.close()

def actualizar_contrasena(id_usuario, nuevo_hash):
    """
    Actualiza el hash de la contraseña de un usuario en la base de datos.
    """
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = "UPDATE Usuario SET password_hash = %s WHERE id_usuario = %s"
            cursor.execute(sql, (nuevo_hash, id_usuario))
        conexion.commit()
        return cursor.rowcount
    finally:
        if conexion:
            conexion.close()

# (Asegúrate de importar tu conexión a la BD, ej: from conexionBD import get_db)

def guardar_token_cache_en_db(id_usuario, token_cache_json):
    """
    Guarda el token cache de MSAL en la columna 'ms_token_cache' del usuario.
    """
    try:
        db = obtener_conexion() # O como obtengas tu conexión
        cursor = db.cursor()

        # --- CORREGIDO (Usuario en lugar de Usuarios) ---
        sql = "UPDATE Usuario SET ms_token_cache = %s WHERE id_usuario = %s"
        cursor.execute(sql, (token_cache_json, id_usuario))

        db.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al guardar token cache en DB: {e}")
        # (Aquí deberías loguear el error)
        return False

# En controladorUsuario.py

def obtener_token_cache_de_db(id_usuario):
    """
    Recupera el token cache de MSAL desde la columna 'ms_token_cache'.
    """
    try:
        db = obtener_conexion()
        cursor = db.cursor()

        sql = "SELECT ms_token_cache FROM Usuario WHERE id_usuario = %s"
        cursor.execute(sql, (id_usuario,))
        resultado = cursor.fetchone()
        cursor.close()

        # --- ✨ INICIO DE LA CORRECCIÓN ✨ ---
        # Tu conexión usa DictCursor, así que debes acceder por el nombre
        # de la columna ('ms_token_cache'), no por el índice [0].

        if resultado and resultado['ms_token_cache']:
            return resultado['ms_token_cache'] # Devuelve el JSON del token cache como texto

        # --- FIN DE LA CORRECCIÓN ---

        return None

    except Exception as e:
        print(f"Error al obtener token cache de DB: {e}")
        # (Loguear error)
        return None



