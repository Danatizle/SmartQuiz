import pymysql
from pymysql import cursors
from pymysql.err import OperationalError, IntegrityError # Importamos errores específicos para mejor manejo
from conexionBD import obtener_conexion

# --- FUNCIONES DE CUESTIONARIO -controlador ---

def crear_cuestionario_completo(titulo, descripcion, visibilidad, id_profesor_creador, preguntas, recompensas, estado='Activo', imagen_portada=None):
    """
    Guarda un cuestionario completo con sus preguntas, respuestas y recompensas en la base de datos.
    """
    # 🔁 NORMALIZAR EL ESTADO
    if estado == 'borrador':
        estado = 'Borrador'
    elif estado == 'activo':
        estado = 'Activo'
    elif estado == 'inactivo':
        estado = 'Inactivo'

    # --- DIAGNÓSTICO: Ver qué valor tiene recompensas ---
    print(f"DEBUG: Valor de recompensas recibido: {recompensas}") # Agrega este print
    # --- FIN DIAGNÓSTICO ---

    conexion = None
    try:
        if not titulo or not preguntas or not id_profesor_creador:
            raise ValueError("Datos incompletos: Título, id de profesor y preguntas son requeridos.")

        conexion = obtener_conexion()
        if conexion is None:
            raise ConnectionError("No se pudo conectar a la base de datos.")

        cursor = conexion.cursor()
        conexion.begin()

        # Insertar Cuestionario
        cursor.execute(
            "INSERT INTO Cuestionario (id_profesor_creador, titulo, descripcion, visibilidad, estado, imagen_portada) VALUES (%s, %s, %s, %s, %s, %s)",
            (id_profesor_creador, titulo, descripcion, visibilidad, estado, imagen_portada)
        )
        id_cuestionario_creado = cursor.lastrowid

        orden_actual = 1

        # Insertar Preguntas y Respuestas
        for pregunta in preguntas:
            pregunta['orden'] = orden_actual

            puntos_recibidos = pregunta.get('puntos', 'Estándar')
            puntos_normalizado = 'Estándar' # Valor por defecto

            if puntos_recibidos: # Asegurarse de que no sea None o vacío
                p_lower = puntos_recibidos.lower().strip()
                if 'doble' in p_lower:
                    puntos_normalizado = 'Puntos dobles'
                elif 'sin' in p_lower:
                    puntos_normalizado = 'Sin puntos'


            cursor.execute(
                """
                INSERT INTO Pregunta (id_cuestionario, texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos, puntos, opcion_rpta, orden)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    id_cuestionario_creado,
                    pregunta['texto_pregunta'],
                    pregunta.get('url_media'), # Añadir esto (usa .get por si no viene)
                    pregunta['tipo_pregunta'],
                    pregunta['tiempo_limite'],
                    puntos_normalizado,
                    pregunta['opcion_rpta'],
                    pregunta['orden']

                )
            )

            id_pregunta_creada = cursor.lastrowid

            orden_actual += 1

            for respuesta in pregunta['respuestas']:
                cursor.execute(
                    "INSERT INTO Respuesta (id_pregunta, texto_respuesta, es_correcta) VALUES (%s, %s, %s)",
                    (id_pregunta_creada, respuesta['texto_respuesta'], respuesta['es_correcta'])
                )

        # Insertar Recompensas
        if recompensas:
            sql_recompensa = "INSERT INTO Recompensa (id_cuestionario, descripcion) VALUES (%s, %s)"
            for recompensa in recompensas:
                if recompensa.get('descripcion'):
                    cursor.execute(sql_recompensa, (id_cuestionario_creado, recompensa['descripcion']))

        conexion.commit()
        return {'id_cuestionario': id_cuestionario_creado}

    except Exception as e:
        if conexion:
            conexion.rollback()
        raise e
    finally:
        if conexion:
            conexion.close()

def obtener_cuestionario_por_id(id_cuestionario):
    """
    Obtiene todos los detalles de un cuestionario, incluyendo sus preguntas y respuestas.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        # CORRECCIÓN: No se necesita pymysql.cursors.DictCursor si ya está en la conexión
        with conexion.cursor() as cursor:
            cursor.execute("SELECT * FROM Cuestionario WHERE id_cuestionario = %s", (id_cuestionario,))
            cuestionario = cursor.fetchone()

            if not cuestionario:
                return None

            # Obtenemos preguntas y respuestas
            cursor.execute("""
                SELECT p.*, r.id_respuesta, r.texto_respuesta, r.es_correcta
                FROM Pregunta p
                LEFT JOIN Respuesta r ON p.id_pregunta = r.id_pregunta
                WHERE p.id_cuestionario = %s
                ORDER BY p.id_pregunta, r.id_respuesta
            """, (id_cuestionario,))
            preguntas_raw = cursor.fetchall()

            # Obtenemos recompensas
            cursor.execute("SELECT descripcion FROM Recompensa WHERE id_cuestionario = %s", (id_cuestionario,))
            recompensas_tuples = cursor.fetchall()
            cuestionario['recompensas'] = [{'descripcion': row['descripcion']} for row in recompensas_tuples]

            preguntas_dict = {}
            for row in preguntas_raw:
                id_pregunta = row['id_pregunta']
                if id_pregunta not in preguntas_dict:
                    preguntas_dict[id_pregunta] = {
                        'id_pregunta': id_pregunta,
                        'texto_pregunta': row['texto_pregunta'],
                        'url_media': row['url_media'], # <-- ¡LÍNEA AÑADIDA!
                        'tipo_pregunta': row['tipo_pregunta'],
                        'tiempo_limite_segundos': row['tiempo_limite_segundos'],
                        'puntos': row['puntos'],
                        'opcion_rpta': row['opcion_rpta'],
                        'respuestas': []
                    }
                if row.get('id_respuesta'):
                    preguntas_dict[id_pregunta]['respuestas'].append({
                        'id_respuesta': row['id_respuesta'],
                        'texto_respuesta': row['texto_respuesta'],
                        'es_correcta': bool(row['es_correcta'])
                    })

            cuestionario['preguntas'] = list(preguntas_dict.values())
            return cuestionario
    except Exception as e:
        raise e
    finally:
        if conexion:
            conexion.close()

# En controladorCuestionario.py

def actualizar_cuestionario_completo(id_cuestionario, titulo, descripcion, visibilidad, preguntas, recompensas, estado=None, imagen_portada=None):
    conexion = None
    try:
        # 🔁 NORMALIZAR EL ESTADO si se proporciona
        if estado is not None:
            if estado == 'borrador':
                estado = 'Borrador'
            elif estado == 'activo':
                estado = 'Activo'
            elif estado == 'inactivo':
                estado = 'Inactivo'

        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            conexion.begin()

            # --- Construcción dinámica del UPDATE para Cuestionario ---
            sql_update_cuestionario = "UPDATE Cuestionario SET titulo=%s, descripcion=%s, visibilidad=%s, imagen_portada=%s"
            params = [titulo, descripcion, visibilidad, imagen_portada]

            if estado is not None:
                sql_update_cuestionario += ", estado=%s"
                params.append(estado)

            sql_update_cuestionario += " WHERE id_cuestionario=%s"
            params.append(id_cuestionario)

            cursor.execute(sql_update_cuestionario, tuple(params))
            # --- Fin UPDATE Cuestionario ---

            # --- Eliminar datos antiguos asociados ---
            # ¡Importante! Eliminar respuestas primero debido a la clave foránea
            cursor.execute("""
                DELETE Respuesta FROM Respuesta
                JOIN Pregunta ON Respuesta.id_pregunta = Pregunta.id_pregunta
                WHERE Pregunta.id_cuestionario = %s
            """, (id_cuestionario,))
            cursor.execute("DELETE FROM Pregunta WHERE id_cuestionario = %s", (id_cuestionario,))
            cursor.execute("DELETE FROM Recompensa WHERE id_cuestionario = %s", (id_cuestionario,))
            # --- Fin Eliminación ---

            # --- Re-insertar Recompensas ---
            if recompensas:
                sql_recompensa = "INSERT INTO Recompensa (id_cuestionario, descripcion) VALUES (%s, %s)"
                for recompensa in recompensas:
                    if recompensa.get('descripcion'):
                        cursor.execute(sql_recompensa, (id_cuestionario, recompensa['descripcion']))
            # --- Fin Recompensas ---

            # --- Re-insertar Preguntas y Respuestas (CON ORDEN) ---
            sql_pregunta = """
                INSERT INTO Pregunta (id_cuestionario, texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos, puntos, opcion_rpta, orden)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            sql_respuesta = "INSERT INTO Respuesta (id_pregunta, texto_respuesta, es_correcta) VALUES (%s, %s, %s)"

            # --- 👇 INICIO DE LA LÓGICA DE ORDEN 👇 ---
            orden_actual = 1 # Inicializa el contador de orden
            # --- --------------------------------- ---

            for pregunta in preguntas:
                pregunta['orden'] = orden_actual # Asigna el número de orden actual
                # --- ----------------------- ---

                tiempo_limite = pregunta.get('tiempo_limite_segundos', pregunta.get('tiempo_limite', 30)) # Valor por defecto 30

                puntos_recibidos = pregunta.get('puntos', 'Estándar')
                puntos_normalizado = 'Estándar' # Valor por defecto

                if puntos_recibidos:
                    p_lower = puntos_recibidos.lower().strip()
                    if 'doble' in p_lower:
                        puntos_normalizado = 'Puntos dobles'
                    elif 'sin' in p_lower:
                        puntos_normalizado = 'Sin puntos'





                cursor.execute(sql_pregunta, (
                    id_cuestionario,
                    pregunta['texto_pregunta'],
                    pregunta.get('url_media'), # Usa .get por si no viene
                    pregunta.get('tipo_pregunta', 'opcion_multiple'), # Valor por defecto
                    tiempo_limite,
                    puntos_normalizado,
                    pregunta['opcion_rpta'],
                    pregunta['orden'] # Ahora usas el valor asignado
                ))
                id_pregunta_creada = cursor.lastrowid

                # --- 👇 INCREMENTO DE ORDEN 👇 ---
                orden_actual += 1 # Incrementa para la siguiente pregunta
                # --- ----------------------- ---

                # Insertar las respuestas de esta pregunta
                for respuesta in pregunta.get('respuestas', []): # Usa .get por seguridad
                    cursor.execute(sql_respuesta, (
                        id_pregunta_creada,
                        respuesta['texto_respuesta'],
                        respuesta['es_correcta']
                    ))
            # --- Fin Re-inserción Preguntas/Respuestas ---

            conexion.commit() # Confirma todos los cambios (UPDATE, DELETE, INSERTs)
            return {'mensaje': 'Cuestionario actualizado correctamente'}

    except Exception as e:
        if conexion:
            conexion.rollback() # Revierte todo si algo falla
        # Es buena idea loggear el error también
        # import logging
        # logging.error(f"Error en actualizar_cuestionario_completo: {e}", exc_info=True)
        raise e # Propaga el error para que la ruta de Flask lo maneje
    finally:
        if conexion:
            conexion.close()

def obtener_cuestionarios_publicos():
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            query = """
                SELECT c.id_cuestionario, c.titulo, c.descripcion, COUNT(p.id_pregunta) as numero_preguntas
                FROM Cuestionario c
                LEFT JOIN Pregunta p ON c.id_cuestionario = p.id_cuestionario
                WHERE c.visibilidad = 'publico' AND c.estado = 'Activo'
                GROUP BY c.id_cuestionario, c.titulo, c.descripcion
                ORDER BY c.fecha_creacion DESC;
            """
            cursor.execute(query)
            return cursor.fetchall()
    except Exception as e:
        print(f"Error en obtener_cuestionarios_publicos: {e}")
        return []
    finally:
        if conexion:
            conexion.close()

def obtener_cuestionarios_por_profesor(id_profesor):
    """Obtiene todos los cuestionarios ACTIVOS de un profesor específico."""
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            query = """
                SELECT c.id_cuestionario, c.titulo, c.descripcion, c.pin_permanente, c.imagen_portada, COUNT(p.id_pregunta) as numero_preguntas
                FROM Cuestionario c
                LEFT JOIN Pregunta p ON c.id_cuestionario = p.id_cuestionario
                WHERE c.id_profesor_creador = %s AND c.estado = 'Activo'
                GROUP BY c.id_cuestionario, c.titulo, c.descripcion, c.pin_permanente, c.imagen_portada
                ORDER BY c.fecha_creacion DESC;
            """
            cursor.execute(query, (id_profesor,))
            return cursor.fetchall()
    finally:
        if conexion:
            conexion.close()

def obtener_cuestionarios_en_papelera_por_profesor(id_profesor):
    """Obtiene todos los cuestionarios en estado 'Inactivo' de un profesor."""
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            query = """
                SELECT c.id_cuestionario, c.titulo, c.imagen_portada, COUNT(p.id_pregunta) as numero_preguntas
                FROM Cuestionario c
                LEFT JOIN Pregunta p ON c.id_cuestionario = p.id_cuestionario
                WHERE c.id_profesor_creador = %s AND c.estado = 'Inactivo'
                GROUP BY c.id_cuestionario, c.titulo, c.imagen_portada
                ORDER BY c.fecha_creacion DESC;
            """
            cursor.execute(query, (id_profesor,))
            return cursor.fetchall()
    finally:
        if conexion:
            conexion.close()

def obtener_cuestionarios_borradores_por_profesor(id_profesor):
    """Obtiene todos los cuestionarios en estado 'borrador' de un profesor específico."""
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            query = """
                SELECT c.id_cuestionario, c.titulo, c.descripcion, COUNT(p.id_pregunta) as numero_preguntas
                FROM Cuestionario c
                LEFT JOIN Pregunta p ON c.id_cuestionario = p.id_cuestionario
                WHERE c.id_profesor_creador = %s AND c.estado = 'borrador'
                GROUP BY c.id_cuestionario, c.titulo, c.descripcion
                ORDER BY c.fecha_creacion DESC;
            """
            cursor.execute(query, (id_profesor,))
            return cursor.fetchall()
    except Exception as e:
        print(f"Error en obtener_cuestionarios_borradores_por_profesor: {e}")
        return []
    finally:
        if conexion:
            conexion.close()

def mover_cuestionario_a_papelera(id_cuestionario):
    """Mueve un cuestionario a la papelera (cambia el estado a 'Inactivo')."""
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "UPDATE Cuestionario SET estado = 'Inactivo' WHERE id_cuestionario = %s"
            cursor.execute(sql, (id_cuestionario,))
            filas_afectadas = cursor.rowcount
            if filas_afectadas > 0:
                conexion.commit()
            return filas_afectadas
    except Exception as e:
        if conexion:
            conexion.rollback()
        raise e
    finally:
        if conexion:
            conexion.close()

def restaurar_cuestionario_desde_papelera(id_cuestionario):
    """Cambia el estado de un cuestionario de 'Inactivo' a 'Activo'."""
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            cursor.execute("UPDATE Cuestionario SET estado = 'Activo' WHERE id_cuestionario = %s", (id_cuestionario,))
            conexion.commit()
            return cursor.rowcount
    finally:
        if conexion:
            conexion.close()

def eliminar_cuestionario_por_id(id_cuestionario):
    """Elimina permanentemente un cuestionario Y SUS PARTIDAS asociadas."""
    conexion = None
    try:
        conexion = obtener_conexion()
        conexion.begin()
        with conexion.cursor() as cursor:
            num_partidas_eliminadas = cursor.execute("DELETE FROM Partida WHERE id_cuestionario = %s", (id_cuestionario,))
            print(f"Eliminadas {num_partidas_eliminadas} partidas asociadas al cuestionario {id_cuestionario}.")
            num_cuestionarios_eliminados = cursor.execute("DELETE FROM Cuestionario WHERE id_cuestionario = %s", (id_cuestionario,))
        conexion.commit()
        return num_cuestionarios_eliminados
    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al eliminar cuestionario {id_cuestionario} y/o sus partidas: {e}")
        raise e
    finally:
        if conexion:
            conexion.close()

# ===============================================================
# --- AÑADE ESTA NUEVA FUNCIÓN A controladorCuestionario.py ---
# ===============================================================
def actualizar_estado_partida(id_partida, nuevo_estado):
    """
    Actualiza el estado de una partida (ej: 'esperando' a 'en_curso').
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "UPDATE Partida SET estado = %s WHERE id_partida = %s"
            cursor.execute(sql, (nuevo_estado, id_partida))
        conexion.commit()
        return cursor.rowcount # Devuelve el número de filas afectadas
    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en actualizar_estado_partida: {e}")
        raise e # Propaga el error para que app.py lo maneje
    finally:
        if conexion:
            conexion.close()

# --- FUNCIONES DE PARTIDA (JUEGO) ---

# def crear_partida(id_cuestionario, pin, estado='esperando'):
#     sql = """
#         INSERT INTO Partida (id_cuestionario, pin_acceso, estado, modo_juego)
#         VALUES (%s, %s, %s, %s)
#     """
#     conexion = None
#     try:
#         conexion = obtener_conexion()
#         if conexion is None:
#              return None
#         with conexion.cursor() as cursor:
#             cursor.execute(sql, (id_cuestionario, pin, estado, 'individual'))
#             id_partida = cursor.lastrowid
#             conexion.commit()
#             return id_partida
#     except Exception as e:
#         print(f"Error (crear_partida): {e}")
#         if 'conexion' in locals() and conexion:
#             conexion.rollback()
#         return None
#     finally:
#         if 'conexion' in locals() and conexion:
#             conexion.close()
def crear_partida(id_cuestionario, pin, estado='esperando', modo_juego='individual'):
    sql = """
        INSERT INTO Partida (id_cuestionario, pin_acceso, estado, modo_juego)
        VALUES (%s, %s, %s, %s)
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        if conexion is None:
             return None
        with conexion.cursor() as cursor:
            cursor.execute(sql, (id_cuestionario, pin, estado, modo_juego))
            id_partida = cursor.lastrowid
            conexion.commit()
            return id_partida
    except Exception as e:
        print(f"Error (crear_partida): {e}")
        if conexion:
            conexion.rollback()
        return None
    finally:
        if conexion:
            conexion.close()

# --- FUNCIÓN CORREGIDA Y UNIFICADA ---
# Se eliminó la versión duplicada y simple de esta función.
def obtener_partida_por_pin(pin):
    """
    Obtiene los datos de una partida y su cuestionario asociado usando el PIN.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        if conexion is None:
             raise ConnectionError("No se pudo obtener la conexión a la base de datos.")
        with conexion.cursor() as cursor:
            cursor.execute("""
                SELECT p.id_partida, p.pin_acceso, p.estado, p.modo_juego,
                       c.id_cuestionario, c.titulo, c.descripcion
                FROM Partida p
                INNER JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                WHERE p.pin_acceso = %s
            """, (pin,))
            return cursor.fetchone()
    except Exception as e:
        print(f"Error en obtener_partida_por_pin: {e}")
        return None
    finally:
        if conexion:
            conexion.close()

def existe_participante_en_partida(id_partida, nombre):
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            cursor.execute("""
                SELECT 1 FROM Participante
                WHERE id_partida = %s AND nombre_usuario_partida = %s
            """, (id_partida, nombre))
            return cursor.fetchone() is not None
    except Exception as e:
        print(f"Error en existe_participante_en_partida: {e}")
        return False
    finally:
        if conexion:
            conexion.close()

def registrar_participante(id_partida, nombre, id_usuario_alumno=None):
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:

            cursor.execute("""
                INSERT INTO Participante (id_partida, nombre_usuario_partida, id_usuario_alumno)
                VALUES (%s, %s, %s)
            """, (id_partida, nombre, id_usuario_alumno))

            id_participante = cursor.lastrowid
            conexion.commit()
            return id_participante
    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en registrar_participante: {e}")
        raise e
    finally:
        if conexion:
            conexion.close()

def actualizar_nombre_participante(id_partida, old_name, new_name):
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            cursor.execute("""
                UPDATE Participante
                SET nombre_usuario_partida = %s
                WHERE id_partida = %s AND nombre_usuario_partida = %s
            """, (new_name, id_partida, old_name))
            conexion.commit()
            return cursor.rowcount > 0
    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en actualizar_nombre_participante: {e}")
        raise e
    finally:
        if conexion:
            conexion.close()

def guardar_pin_permanente(id_cuestionario, pin):
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            cursor.execute(
                "UPDATE Cuestionario SET pin_permanente = %s WHERE id_cuestionario = %s",
                (pin, id_cuestionario)
            )
            conexion.commit()
    finally:
        if conexion:
            conexion.close()

def existe_pin_en_cuestionario(pin):
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            cursor.execute("SELECT 1 FROM Cuestionario WHERE pin_permanente = %s", (pin,))
            return cursor.fetchone() is not None
    finally:
        if conexion:
            conexion.close()




def cuestionario_tiene_preguntas(id_cuestionario):
    """
    Verifica si un cuestionario tiene al menos una pregunta.
    Devuelve True si tiene preguntas, False si no.
    """
    # ✅ CORRECCIÓN: Se llama directamente a la función importada
    conexion = obtener_conexion()
    if not conexion:
        return False
    try:
        with conexion.cursor() as cursor:
            # Consulta para contar las preguntas de un cuestionario específico
            sql = "SELECT COUNT(id_pregunta) as total FROM Pregunta WHERE id_cuestionario = %s"
            cursor.execute(sql, (id_cuestionario,))
            resultado = cursor.fetchone()
            # Si el conteo es mayor que 0, devuelve True
            return resultado and resultado['total'] > 0
    finally:
        if conexion:
            conexion.close()
    return False



def obtener_datos_partida_profesor(pin):
    """
    Recolecta y estructura TODOS los datos necesarios para la vista en vivo del profesor.
    Esta es la función principal que alimenta la pantalla del profesor.
    """
    conexion = None
    try:
        conexion = conexionBD.obtener_conexion()
        with conexion.cursor() as cursor:
            # 1. Obtener datos de la partida, INCLUYENDO pregunta_actual_orden
            sql_partida = """
                SELECT p.id_partida, p.id_cuestionario, p.estado, p.pregunta_actual_orden,
                       c.titulo
                FROM Partida p
                JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                WHERE p.pin_acceso = %s
            """
            cursor.execute(sql_partida, (pin,))
            partida = cursor.fetchone()

            if not partida or partida['estado'] == 'finalizado':
                return {'estado_juego': 'finalizado'}

            # 2. Obtener la lista de todos los participantes en la partida
            cursor.execute("SELECT id_participante, nombre_usuario_partida FROM Participante WHERE id_partida = %s AND estado = 'activo'", (partida['id_partida'],))
            participantes = cursor.fetchall()
            total_participantes = len(participantes)

            # --- CASO ESPECIAL: El juego ha empezado pero espera la primera pregunta ---
            if not partida['pregunta_actual_orden']:
                return {
                    'estado_juego': 'en_curso',
                    'pregunta_actual': None,
                    'respuestas_info': {'recibidas': 0, 'total': total_participantes, 'estadisticas': {}},
                    'marcador': [],
                    'estudiantes': [{'nombre_usuario_partida': p['nombre_usuario_partida'], 'ha_respondido': False} for p in participantes]
                }

            # 3. Si ya hay una pregunta activa, obtener sus detalles
            sql_pregunta = """
                SELECT p.id_pregunta, p.texto_pregunta, p.tiempo_limite_segundos AS tiempo, p.orden,
                       (SELECT COUNT(*) FROM Pregunta WHERE id_cuestionario = p.id_cuestionario) as total_preguntas
                FROM Pregunta p
                WHERE p.id_cuestionario = %s AND p.orden = %s
            """
            cursor.execute(sql_pregunta, (partida['id_cuestionario'], partida['pregunta_actual_orden']))
            pregunta_actual_data = cursor.fetchone()

            if not pregunta_actual_data:
                 raise ValueError("No se encontró la pregunta activa en la base de datos.")

            id_pregunta_actual = pregunta_actual_data['id_pregunta']
            pregunta_actual_data['numero'] = pregunta_actual_data['orden'] # Renombrar para el frontend
            pregunta_actual_data['texto'] = pregunta_actual_data['texto_pregunta']

            # 4. Obtener respuestas de los alumnos y estadísticas
            sql_respuestas_alumnos = """
                SELECT pr.id_participante, r.texto_respuesta
                FROM ParticipanteRespuesta pr
                JOIN Respuesta r ON pr.id_respuesta_seleccionada = r.id_respuesta
                WHERE pr.id_pregunta = %s
            """
            cursor.execute(sql_respuestas_alumnos, (id_pregunta_actual,))
            respuestas_alumnos = cursor.fetchall()

            ids_alumnos_respondido = {r['id_participante'] for r in respuestas_alumnos}
            respuestas_recibidas = len(ids_alumnos_respondido)

            # Calcular estadísticas para el gráfico de barras
            estadisticas = {'A': 0, 'B': 0, 'C': 0, 'D': 0} # Asumimos 4 opciones
            # (Aquí iría la lógica para contar cuántos alumnos eligieron cada opción)

            # 5. Mapear estudiantes y su estado de respuesta
            estudiantes_con_estado = []
            for p in participantes:
                estudiantes_con_estado.append({
                    'nombre_usuario_partida': p['nombre_usuario_partida'],
                    'ha_respondido': p['id_participante'] in ids_alumnos_respondido
                })

            # 6. Calcular el marcador (Top 5)
            sql_marcador = """
                SELECT nombre_usuario_partida, puntuacion_total
                FROM Participante
                WHERE id_partida = %s AND estado = 'activo'
                ORDER BY puntuacion_total DESC
                LIMIT 5
            """
            cursor.execute(sql_marcador, (partida['id_partida'],))
            marcador = cursor.fetchall()

            # 7. Ensamblar el objeto final de datos
            return {
                'estado_juego': 'en_curso',
                'pregunta_actual': pregunta_actual_data,
                'respuestas_info': {
                    'recibidas': respuestas_recibidas,
                    'total': total_participantes,
                    'estadisticas': estadisticas
                },
                'marcador': marcador,
                'estudiantes': estudiantes_con_estado
            }

    except Exception as e:
        print(f"Error en obtener_datos_partida_profesor: {e}") # Imprime el error en los logs del servidor
        return {'estado_juego': 'error', 'message': str(e)}
    finally:
        if conexion:
            conexion.close()