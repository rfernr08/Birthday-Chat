import os
import sqlite3
from datetime import datetime

# Get the directory where this script (database.py) is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Navigate to the parent directory, then into 'data'
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")

DB_PATH = os.path.join(DATA_DIR, "chat.db")


def init_db():
    # Ensure the directory exists (optional safety net)
    os.makedirs(DATA_DIR, exist_ok=True)

    """Crea las tablas necesarias si no existen."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_unico TEXT UNIQUE NOT NULL,
            nombre_real TEXT NOT NULL,
            alias_anonimo TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            canal TEXT NOT NULL,
            contenido TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    """)

    conn.commit()
    conn.close()


def registrar_usuario(codigo, nombre, alias):
    """Permite al administrador precargar a sus amigos en el sistema."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO usuarios (codigo_unico, nombre_real, alias_anonimo) VALUES (?, ?, ?)",
            (codigo, nombre, alias),
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False  # El código ya existe


def verificar_codigo(codigo):
    """Verifica si un código es válido y devuelve los datos del usuario."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, alias_anonimo FROM usuarios WHERE codigo_unico = ?", (codigo,)
    )
    res = cursor.fetchone()
    conn.close()
    return res  # Devuelve (id, alias) o None si no existe


def guardar_mensaje(usuario_id, canal, contenido):
    """Guarda un mensaje enviado por un usuario en un canal específico."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO mensajes (usuario_id, canal, contenido, timestamp) VALUES (?, ?, ?, ?)",
        (usuario_id, canal, contenido, timestamp),
    )
    conn.commit()
    conn.close()


def obtener_historial(canal):
    """Recupera los últimos mensajes de un canal con el alias del autor."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT u.alias_anonimo, m.contenido, m.timestamp
        FROM mensajes m
        JOIN usuarios u ON m.usuario_id = u.id
        WHERE m.canal = ?
        ORDER BY m.id ASC
    """,
        (canal,),
    )
    historial = cursor.fetchall()
    conn.close()
    return [{"alias": h[0], "contenido": h[1], "timestamp": h[2]} for h in historial]
