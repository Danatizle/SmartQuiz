from conexionBD import obtener_conexion

def obtener_quizzes_publicos(excluir_id_profesor=None):
    """
    Obtiene todos los quizzes públicos que no pertenecen al profesor actual.
    La conexión ya devuelve diccionarios, por lo que el código es más limpio.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        if not conexion:
            print("FALLO EN LA CONEXIÓN: obtener_conexion() devolvió None.")
            return []

        with conexion.cursor() as cursor:
            sql = """
                SELECT 
                    c.id_cuestionario,
                    c.titulo,
                    c.imagen_portada,
                    CONCAT(u.nombres, ' ', u.apellidos) AS creador,
                    (SELECT COUNT(*) FROM Pregunta WHERE id_cuestionario = c.id_cuestionario) AS num_preguntas,
                    (SELECT COUNT(DISTINCT p.id_usuario_alumno) 
                     FROM Partida pa 
                     JOIN Participante p ON pa.id_partida = p.id_partida 
                     WHERE pa.id_cuestionario = c.id_cuestionario) AS veces_jugado
                FROM Cuestionario c
                JOIN Usuario u ON c.id_profesor_creador = u.id_usuario
                WHERE c.visibilidad = 'publico' AND c.estado = 'Activo'
                  AND (%s IS NULL OR c.id_profesor_creador != %s)
                ORDER BY c.fecha_creacion DESC;
            """
            cursor.execute(sql, (excluir_id_profesor, excluir_id_profesor))
            
            # Gracias a DictCursor, esto ya es una lista de diccionarios. No se necesita conversión manual.
            quizzes = cursor.fetchall()
            print(f"CONTROLADOR: Se encontraron {len(quizzes)} quizzes públicos para explorar.")
            return quizzes
            
    except Exception as e:
        print(f"Error en obtener_quizzes_publicos: {e}")
        return []
    finally:
        if conexion:
            conexion.close()

def duplicar_quiz(id_cuestionario_original, id_nuevo_profesor):
    """
    Duplica un cuestionario con todas sus preguntas, respuestas y recompensas.
    El nuevo quiz se guarda como privado y activo con el sufijo ' - Copia'.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # Inicia una transacción para asegurar que toda la operación se complete o se deshaga
            conexion.begin()

            # 1. Leer datos del cuestionario original
            cursor.execute("SELECT * FROM Cuestionario WHERE id_cuestionario = %s", (id_cuestionario_original,))
            cuestionario_original = cursor.fetchone()
            if not cuestionario_original:
                raise ValueError("El cuestionario a duplicar no existe.")

            # 2. Crear el nuevo cuestionario
            nuevo_titulo = f"{cuestionario_original['titulo']} - Copia"
            sql_nuevo_cuestionario = """
                INSERT INTO Cuestionario (id_profesor_creador, titulo, descripcion, visibilidad, estado, imagen_portada)
                VALUES (%s, %s, %s, 'privado', 'Activo', %s)
            """
            cursor.execute(sql_nuevo_cuestionario, (
                id_nuevo_profesor, nuevo_titulo, cuestionario_original['descripcion'], cuestionario_original['imagen_portada']
            ))
            id_cuestionario_nuevo = cursor.lastrowid

            # 3. Duplicar preguntas y sus respuestas
            cursor.execute("SELECT * FROM Pregunta WHERE id_cuestionario = %s", (id_cuestionario_original,))
            preguntas_originales = cursor.fetchall()

            for pregunta_original in preguntas_originales:
                sql_nueva_pregunta = """
                    INSERT INTO Pregunta (id_cuestionario, texto_pregunta, url_media, tipo_pregunta, tiempo_limite_segundos, puntos, opcion_rpta)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql_nueva_pregunta, (
                    id_cuestionario_nuevo, pregunta_original['texto_pregunta'], pregunta_original['url_media'],
                    pregunta_original['tipo_pregunta'], pregunta_original['tiempo_limite_segundos'],
                    pregunta_original['puntos'], pregunta_original['opcion_rpta']
                ))
                id_pregunta_nueva = cursor.lastrowid

                cursor.execute("SELECT * FROM Respuesta WHERE id_pregunta = %s", (pregunta_original['id_pregunta'],))
                respuestas_originales = cursor.fetchall()
                for respuesta_original in respuestas_originales:
                    sql_nueva_respuesta = "INSERT INTO Respuesta (id_pregunta, texto_respuesta, es_correcta) VALUES (%s, %s, %s)"
                    cursor.execute(sql_nueva_respuesta, (
                        id_pregunta_nueva, respuesta_original['texto_respuesta'], respuesta_original['es_correcta']
                    ))
            
            # 4. Duplicar las recompensas
            cursor.execute("SELECT * FROM Recompensa WHERE id_cuestionario = %s", (id_cuestionario_original,))
            recompensas_originales = cursor.fetchall()
            for recompensa in recompensas_originales:
                sql_nueva_recompensa = """
                    INSERT INTO Recompensa (id_cuestionario, descripcion, condicion, url_imagen)
                    VALUES (%s, %s, %s, %s)
                """
                cursor.execute(sql_nueva_recompensa, (
                    id_cuestionario_nuevo,
                    recompensa['descripcion'],
                    recompensa['condicion'],
                    recompensa['url_imagen']
                ))

            # 5. Si todo salió bien, confirma los cambios
            conexion.commit()
            return {'success': True, 'new_quiz_id': id_cuestionario_nuevo}

    except Exception as e:
        if conexion:
            conexion.rollback() # Si algo falla, deshace toda la operación
        print(f"Error al duplicar el quiz: {e}")
        raise e # Relanza el error para que app.py lo maneje
    finally:
        if conexion:
            conexion.close()

