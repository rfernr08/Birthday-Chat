import os

import requests
import secrets
from servidor import database as db

URL_BASE = "http://127.0.0.1:8000"

def mostrar_menu():
    print("\n" + "="*45)
    print("      FUL-CHAT-MEN :: PANEL DE ADMINISTRACIÓN      ")
    print("="*45)
    print("1. Alternar Estado del Chat (Abrir/Cerrar Escritura)")
    print("2. Ver Estado Actual del Chat")
    print("3. Registrar Nuevo Amigo (Generar Código)")
    print("4. Salir")
    print("="*45)
    return input("Selecciona una opción (1-4): ").strip()

def alternar_chat():
    try:
        res = requests.post(f"{URL_BASE}/admin/toggle-chat")
        if res.status_code == 200:
            abierto = res.json()["chat_abierto"]
            estado = "ABIERTO (Pueden escribir)" if abierto else "CERRADO (Solo lectura)"
            print(f"\n[ÉXITO] El estado del chat ahora es: {estado}")
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] No se pudo conectar con el servidor.")

def ver_estado():
    try:
        res = requests.get(f"{URL_BASE}/admin/status")
        if res.status_code == 200:
            abierto = res.json()["chat_abierto"]
            estado = "ABIERTO (Pueden escribir)" if abierto else "CERRADO (Solo lectura)"
            print(f"\n[ESTADO] El chat está actualmente: {estado}")
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] El servidor está apagado.")

def registrar_amigo():
    print("\n--- REGISTRAR NUEVO PARTICIPANTE ---")
    nombre_real = input("Nombre real: ").strip()
    alias_anonimo = input("Alias anónimo: ").strip()
    
    if not nombre_real or not alias_anonimo:
        print("[ERROR] Los campos no pueden estar vacíos.")
        return
    
    codigo = secrets.token_hex(3).upper()
    
    exito = db.registrar_usuario(codigo, nombre_real, alias_anonimo)
    if exito:
        print("\n" + "-"*40)
        print(f"Usuario registrado")
        print(f"Nombre: {nombre_real}")
        print(f"Alias: {alias_anonimo}")
        print(f"Codigo secreto: {codigo}")
        print("-"*40)
    else:
        print("[ERROR] Hubo un problema al guardar en la base de datos.")

def main():
    db.init_db()
    
    while True:
        opcion = mostrar_menu()
        if opcion == "1":
            alternar_chat()
        elif opcion == "2":
            ver_estado()
        elif opcion == "3":
            registrar_amigo()
        elif opcion == "4":
            print("\nCerrando panel de administración.")
            break
        else:
            print("\n[OPCIÓN NO VÁLIDA]")

if __name__ == "__main__":
    main()