# controladorActividadAlumno.py
from conexionBD import obtener_conexion
import logging
import random

def obtener_feed_actividad():
    """
    ✅ ESTA FUNCIÓN ES PARA TU PÁGINA "EXPLORAR".
    Obtiene todos los cuestionarios públicos.
    """
    conexion = None
    quizzes = []
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # Esta consulta obtiene todos los quizzes públicos
            # sin excluir a ningún profesor.
            sql = """
                SELECT 
                    c.id_cuestionario,
                    c.titulo,
                    c.imagen_portada,
                    CONCAT(u.nombres, ' ', u.apellidos) AS creador,
                    (SELECT COUNT(*) FROM Pregunta WHERE id_cuestionario = c.id_cuestionario) AS num_preguntas,
                    (SELECT COUNT(DISTINCT p.id_participante) 
                     FROM Partida pa 
                     JOIN Participante p ON pa.id_partida = p.id_partida 
                     WHERE pa.id_cuestionario = c.id_cuestionario) AS veces_jugado
                FROM Cuestionario c
                JOIN Usuario u ON c.id_profesor_creador = u.id_usuario
                WHERE c.visibilidad = 'publico' AND c.estado = 'Activo'
                ORDER BY c.fecha_creacion DESC;
            """
            cursor.execute(sql)
            quizzes = cursor.fetchall()

    except Exception as e:
        logging.error(f"Error en obtener_feed_actividad: {e}", exc_info=True)
        return []
    finally:
        if conexion:
            conexion.close()
    return quizzes

def obtener_resultados_alumno(id_alumno):
    """
    ESTA FUNCIÓN ES PARA TU PÁGINA "INICIO".
    Obtiene el historial personal de quizzes jugados.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = """
            SELECT
                c.id_cuestionario,
                c.titulo AS nombre_cuestionario,
                c.imagen_portada,
                DATE_FORMAT(p.fecha_union, '%%d-%%m-%%Y') AS fecha,
                COALESCE(p.puntuacion_total, 0) AS puntuacion,
                CONCAT(u.nombres, ' ', u.apellidos) AS creador,
                (SELECT 
                    IFNULL( (SUM(r.es_correcta) / NULLIF(COUNT(rp.id_respuesta_participante), 0)) * 100, 0)
                 FROM RespuestaParticipante AS rp
                 JOIN Respuesta AS r ON rp.id_respuesta_seleccionada = r.id_respuesta
                 WHERE rp.id_participante = p.id_participante
                ) AS precision_calculada
            FROM Participante AS p
            JOIN Partida AS part ON p.id_partida = part.id_partida
            JOIN Cuestionario AS c ON part.id_cuestionario = c.id_cuestionario
            JOIN Usuario AS u ON c.id_profesor_creador = u.id_usuario
            WHERE p.id_usuario_alumno = %s
            GROUP BY p.id_participante, c.id_cuestionario, c.titulo, c.imagen_portada, p.fecha_union, p.puntuacion_total, u.nombres, u.apellidos
            ORDER BY p.fecha_union DESC;
            """
            cursor.execute(sql, (id_alumno,))
            resultados = cursor.fetchall()
            
            colores = [
                'linear-gradient(45deg, #f0c419, #f5d45c)', 'linear-gradient(45deg, #4a4e69, #6b7091)',
                'linear-gradient(45deg, #63a4ff, #8ab8ff)', 'linear-gradient(45deg, #d90429, #e63946)',
                'linear-gradient(45deg, #2a9d8f, #4cc9b0)', 'linear-gradient(45deg, #f4a261, #e76f51)'
            ]
            
            for res in resultados:
                res['color'] = random.choice(colores)
                res['precision'] = round(res.get('precision_calculada', 0))

            return resultados

    except Exception as e:
        logging.error(f"Error en obtener_resultados_alumno: {e}", exc_info=True)
        return []
    finally:
        if conexion:
            conexion.close()