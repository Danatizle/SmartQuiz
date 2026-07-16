# Este archivo contiene la lógica para interactuar con las tablas Pregunta, Respuesta y Recompensa.

from conexionBD import obtener_conexion # CORREGIDO: Importa desde tu archivo de conexión

# --- CRUD para Pregunta (Adaptado a tu tabla `Pregunta`) ---

def insertar_pregunta(id_cuestionario, texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos):
    conexion = obtener_conexion()
    with conexion.cursor() as cursor:
        cursor.execute(
            "INSERT INTO Pregunta(id_cuestionario, texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos) VALUES (%s, %s, %s, %s, %s)",
            (id_cuestionario, texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos)
        )
    conexion.commit()
    id_insertado = cursor.lastrowid
    conexion.close()
    return id_insertado

def eliminar_pregunta(id_pregunta):
    conexion = obtener_conexion()
    with conexion.cursor() as cursor:
        cursor.execute("DELETE FROM Pregunta WHERE id_pregunta = %s", (id_pregunta,))
    conexion.commit()
    filas_afectadas = cursor.rowcount
    conexion.close()
    return filas_afectadas

def actualizar_pregunta(id_pregunta, texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos):
    conexion = obtener_conexion()
    with conexion.cursor() as cursor:
        cursor.execute(
            "UPDATE Pregunta SET texto_pregunta = %s, url_media = %s, tipo_pregunta = %s, tiempo_limite_segundos = %s WHERE id_pregunta = %s",
            (texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos, id_pregunta)
        )
    conexion.commit()
    filas_afectadas = cursor.rowcount
    conexion.close()
    return filas_afectadas

# --- CRUD para Respuesta (Adaptado a tu tabla `Respuesta`) ---

def obtener_respuestas_por_pregunta(id_pregunta):
    conexion = obtener_conexion()
    with conexion.cursor() as cursor: # Usamos DictCursor por defecto desde conexionBD
        cursor.execute("SELECT id_respuesta, texto_respuesta, es_correcta FROM Respuesta WHERE id_pregunta = %s", (id_pregunta,))
        respuestas = cursor.fetchall()
    conexion.close()
    return respuestas

def actualizar_respuestas_pregunta(id_pregunta, respuestas):
    conexion = obtener_conexion()
    with conexion.cursor() as cursor:
        cursor.execute("DELETE FROM Respuesta WHERE id_pregunta = %s", (id_pregunta,))
        if respuestas:
            valores_respuestas = [(id_pregunta, r['texto'], r['es_correcta']) for r in respuestas]
            cursor.executemany(
                "INSERT INTO Respuesta(id_pregunta, texto_respuesta, es_correcta) VALUES (%s, %s, %s)",
                valores_respuestas
            )
    conexion.commit()
    conexion.close()

# --- Función Combinada (Adaptada) ---

def obtener_preguntas_completas_por_cuestionario(id_cuestionario):
    conexion = obtener_conexion()
    preguntas_final = []
    with conexion.cursor() as cursor:
        cursor.execute("SELECT * FROM Pregunta WHERE id_cuestionario = %s ORDER BY id_pregunta ASC", (id_cuestionario,))
        preguntas = cursor.fetchall()
        for pregunta in preguntas:
            pregunta['respuestas'] = obtener_respuestas_por_pregunta(pregunta['id_pregunta'])
            preguntas_final.append(pregunta)
    conexion.close()
    return preguntas_final

# --- Funciones para Recompensa ---

def guardar_recompensas_cuestionario(id_cuestionario, recompensas):
    conexion = obtener_conexion()
    with conexion.cursor() as cursor:
        cursor.execute("DELETE FROM Recompensa WHERE id_cuestionario = %s", (id_cuestionario,))
        if recompensas:
            valores_recompensas = [
                (id_cuestionario, r['descripcion'], r['condicion']) for r in recompensas
            ]
            cursor.executemany(
                "INSERT INTO Recompensa(id_cuestionario, descripcion, condicion) VALUES (%s, %s, %s)",
                valores_recompensas
            )
    conexion.commit()
    conexion.close()


# --- FUNCIONES NUEVAS Y SEGURAS (AÑADIR ESTAS AL FINAL) ---
# Estas son las funciones que tu app.py debe llamar

def crear_pregunta_completa(id_cuestionario, datos_pregunta):
    """
    1. REGISTRAR: Crea una pregunta Y sus respuestas en una transacción.
    Usa los nombres de tu tabla (puntos, opcion_rpta, etc.)
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # 1. Insertar la Pregunta principal con todos los campos
            cursor.execute(
                """
                INSERT INTO Pregunta(
                    id_cuestionario, texto_pregunta, url_media, tipo_pregunta,
                    tiempo_limite_segundos, estado, puntos, opcion_rpta, orden
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    id_cuestionario,
                    datos_pregunta.get('texto_pregunta'),
                    datos_pregunta.get('url_media'),
                    datos_pregunta.get('tipo_pregunta', 'opcion_multiple'),
                    datos_pregunta.get('tiempo_limite_segundos', 20),
                    datos_pregunta.get('estado', 'Activo'),
                    datos_pregunta.get('puntos', 'Estándar'),
                    datos_pregunta.get('opcion_rpta', 'Selección simple'),
                    datos_pregunta.get('orden')
                )
            )
            id_pregunta_nueva = cursor.lastrowid

            # 2. Insertar las Opciones (Respuestas)
            opciones = datos_pregunta.get('opciones', [])
            if opciones:
                # El JSON de cada opción debe tener 'texto_respuesta' y 'es_correcta'
                # ¡CORRECCIÓN IMPORTANTE! Tu función original esperaba r['texto'],
                # pero tu tabla Respuesta usa 'texto_respuesta'.
                # Usaremos los nombres del JSON que definimos en el Paso 3.
                valores_opciones = [
                    (id_pregunta_nueva, opt['texto_respuesta'], opt.get('es_correcta', False))
                    for opt in opciones
                ]
                cursor.executemany(
                    "INSERT INTO Respuesta(id_pregunta, texto_respuesta, es_correcta) VALUES (%s, %s, %s)",
                    valores_opciones
                )

        conexion.commit()
        # Retorna el objeto completo llamando a la función de abajo
        return obtener_pregunta_completa_por_id(id_pregunta_nueva)

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en crear_pregunta_completa: {e}")
        raise # Propaga el error para que la API lo capture
    finally:
        if conexion:
            conexion.close()

def obtener_pregunta_completa_por_id(id_pregunta, id_profesor=None):
    """
    3. OBTENER POR ID: Esta es la función que te faltaba.
    Obtiene una pregunta con sus respuestas y todas las columnas.
    Si se provee id_profesor, también valida que le pertenezca.
    """
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            # 1. Consulta principal (une Pregunta y Cuestionario para seguridad)
            sql = """
                SELECT
                    p.id_pregunta, p.id_cuestionario, p.texto_pregunta,
                    p.url_media, p.tipo_pregunta, p.tiempo_limite_segundos,
                    p.estado, p.puntos, p.opcion_rpta, p.orden,
                    c.id_profesor_creador
                FROM Pregunta p
                JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                WHERE p.id_pregunta = %s
            """
            cursor.execute(sql, (id_pregunta,))
            pregunta = cursor.fetchone()

            if not pregunta:
                return None # No se encontró

            # 2. Verificación de seguridad
            if id_profesor and pregunta['id_profesor_creador'] != id_profesor:
                return None # Encontrado, pero no le pertenece

            # 3. Obtener opciones (usando la función que YA tenías)
            pregunta['opciones'] = obtener_respuestas_por_pregunta(pregunta['id_pregunta'])

            return pregunta

    finally:
        if conexion:
            conexion.close()

def actualizar_pregunta_completa(id_pregunta, id_profesor, datos_pregunta):
    """
    2. ACTUALIZAR: Actualiza una pregunta y sus respuestas, verificando al propietario.
    """
    conexion = None
    try:
        # 1. Verificar propiedad (¡MUY IMPORTANTE!)
        pregunta_existente = obtener_pregunta_completa_por_id(id_pregunta, id_profesor)
        if not pregunta_existente:
            return None # Si no existe o no es el dueño, no actualiza

        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # 2. Actualizar la Pregunta principal (usando tu función original)
            actualizar_pregunta(
                id_pregunta,
                datos_pregunta.get('texto_pregunta', pregunta_existente['texto_pregunta']),
                datos_pregunta.get('url_media', pregunta_existente['url_media']),
                datos_pregunta.get('tipo_pregunta', pregunta_existente['tipo_pregunta']),
                datos_pregunta.get('tiempo_limite_segundos', pregunta_existente['tiempo_limite_segundos'])
            )

            # 2b. Actualizar los campos extra que tu función original ignoraba
            cursor.execute(
                """
                UPDATE Pregunta SET
                    estado = %s,
                    puntos = %s,
                    opcion_rpta = %s,
                    orden = %s
                WHERE id_pregunta = %s
                """,
                (
                    datos_pregunta.get('estado', pregunta_existente['estado']),
                    datos_pregunta.get('puntos', pregunta_existente['puntos']),
                    datos_pregunta.get('opcion_rpta', pregunta_existente['opcion_rpta']),
                    datos_pregunta.get('orden', pregunta_existente['orden']),
                    id_pregunta
                )
            )

            # 3. Actualizar las Opciones (usando tu función original)
            # ¡CORRECCIÓN IMPORTANTE! Tu función 'actualizar_respuestas_pregunta'
            # espera r['texto'], pero tu JSON enviará 'texto_respuesta'.
            # La modificaremos aquí para que sea compatible.
            if 'opciones' in datos_pregunta:
                opciones = datos_pregunta['opciones']
                cursor.execute("DELETE FROM Respuesta WHERE id_pregunta = %s", (id_pregunta,))
                if opciones:
                    valores_respuestas = [(id_pregunta, r['texto_respuesta'], r['es_correcta']) for r in opciones]
                    cursor.executemany(
                        "INSERT INTO Respuesta(id_pregunta, texto_respuesta, es_correcta) VALUES (%s, %s, %s)",
                        valores_respuestas
                    )

        conexion.commit()
        # Retorna la pregunta actualizada
        return obtener_pregunta_completa_por_id(id_pregunta, id_profesor)

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en actualizar_pregunta_completa: {e}")
        raise
    finally:
        if conexion:
            conexion.close()

def eliminar_pregunta_con_seguridad(id_pregunta, id_profesor):
    """
    5. ELIMINAR: Elimina una pregunta, verificando primero que le pertenece al profesor.
    """
    try:
        # 1. Verificar propiedad
        pregunta_existente = obtener_pregunta_completa_por_id(id_pregunta, id_profesor)

        if not pregunta_existente:
            # Si no existe o no le pertenece, retornamos 0 filas afectadas
            return 0

        # 2. Si le pertenece, usar la función de borrado que YA tenías
        # (Esto asume que tu BD tiene "ON DELETE CASCADE" para borrar las Respuestas)
        filas_afectadas = eliminar_pregunta(id_pregunta)

        return filas_afectadas

    except Exception as e:
        print(f"Error en eliminar_pregunta_con_seguridad: {e}")
        raise