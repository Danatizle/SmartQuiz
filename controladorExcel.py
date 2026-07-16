import pandas as pd

def parsear_excel_a_json(archivo_excel):
    """
    Lee un archivo Excel y lo transforma en la estructura JSON 
    que 'crear_cuestionario_completo' espera.
    """
    try:
        # Lee la hoja 'Preguntas' del archivo Excel, tratando todo como string
        df = pd.read_excel(archivo_excel, sheet_name='Preguntas', dtype=str)
        # Reemplaza valores vacíos (NaN) con None para evitar errores
        df = df.where(pd.notna(df), None)

        preguntas_json = []

        # 🔹 Función auxiliar para convertir texto a booleano
        def convertir_bool(valor):
            if not valor:
                return False
            texto = str(valor).strip().upper()
            return texto in ['VERDADERO', 'TRUE', 'SI', 'SÍ', '1', 'X']

        # Itera sobre cada fila del Excel (cada fila es una pregunta)
        for _, fila in df.iterrows():
            
            respuestas = []

            for i in range(1, 5):  # respuesta_1 hasta respuesta_4
                texto_col = f"respuesta_{i}_texto"
                correcta_col = f"respuesta_{i}_es_correcta"

                texto = fila.get(texto_col)
                es_correcta = convertir_bool(fila.get(correcta_col))

                if texto:  # Solo agregar si hay texto
                    respuestas.append({
                        "texto_respuesta": str(texto).strip(),
                        "es_correcta": bool(es_correcta)
                    })

            pregunta = {
                "texto_pregunta": fila['pregunta_texto'],
                "tipo_pregunta": fila.get('tipo_pregunta', 'opcion_multiple'),
                "tiempo_limite": int(fila.get('tiempo_limite_segundos', 20)),
                "puntos": fila.get('puntos', 'Estándar'),
                "opcion_rpta": fila.get('opcion_rpta', 'Selección simple'),
                "url_media": fila.get('url_media (opcional)'),
                "respuestas": respuestas
            }
            
            preguntas_json.append(pregunta)
        
        return preguntas_json

    except Exception as e:
        print(f"Error al parsear Excel: {e}")
        raise ValueError("Error al leer el archivo Excel. Revisa el formato y las columnas.")
