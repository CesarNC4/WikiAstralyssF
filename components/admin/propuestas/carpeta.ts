/**
 * La carpeta `lore/propuestas/` del equipo del autor, leída desde el navegador con la
 * File System Access API (Chrome y Edge). El navegador recuerda el permiso y guardamos
 * la referencia a la carpeta en IndexedDB, que es el único sitio donde cabe: así la
 * siguiente visita solo pide confirmar el permiso, sin volver a elegirla.
 *
 * El contenido nunca sale de aquí salvo para analizarlo y aplicarlo: ni se guarda en la
 * base ni en el navegador.
 */

// Esta API aún no está en los tipos del DOM de TypeScript.
type ModoPermiso = { mode: "readwrite" };
export interface Carpeta extends FileSystemDirectoryHandle {
  queryPermission(d: ModoPermiso): Promise<PermissionState>;
  requestPermission(d: ModoPermiso): Promise<PermissionState>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}
declare global {
  interface Window {
    showDirectoryPicker?: (o?: { id?: string; mode?: "readwrite" }) => Promise<Carpeta>;
  }
}

const BD = "astralys-propuestas";
const ALMACEN = "carpeta";
const CLAVE = "actual";

export const hayCarpetas = () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

function abrirBd(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

/** La carpeta recordada, o null. Sin IndexedDB (ventana privada) no se recuerda y ya está. */
export async function carpetaRecordada(): Promise<Carpeta | null> {
  try {
    const bd = await abrirBd();
    return await new Promise((ok) => {
      const r = bd.transaction(ALMACEN).objectStore(ALMACEN).get(CLAVE);
      r.onsuccess = () => ok((r.result as Carpeta) ?? null);
      r.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

async function recordar(carpeta: Carpeta | null) {
  try {
    const bd = await abrirBd();
    const almacen = bd.transaction(ALMACEN, "readwrite").objectStore(ALMACEN);
    if (carpeta) almacen.put(carpeta, CLAVE);
    else almacen.delete(CLAVE);
  } catch {
    // Sin recordar: la próxima vez se elige otra vez.
  }
}

/** Abre el selector de carpetas. Null si el autor cancela. Hace falta un clic del usuario. */
export async function elegirCarpeta(): Promise<Carpeta | null> {
  try {
    const carpeta = await window.showDirectoryPicker!({ id: "propuestas", mode: "readwrite" });
    await recordar(carpeta);
    return carpeta;
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    throw e;
  }
}

export const olvidarCarpeta = () => recordar(null);

export const tienePermiso = async (c: Carpeta) => (await c.queryPermission({ mode: "readwrite" })) === "granted";
/** Pide el permiso de nuevo. Hace falta un clic del usuario. */
export const pedirPermiso = async (c: Carpeta) => (await c.requestPermission({ mode: "readwrite" })) === "granted";

/** Los .md de la carpeta, sin entrar en subcarpetas. */
export async function leerCarpeta(carpeta: Carpeta): Promise<{ nombre: string; texto: string }[]> {
  const out: { nombre: string; texto: string }[] = [];
  for await (const h of carpeta.values()) {
    if (h.kind !== "file" || !h.name.toLowerCase().endsWith(".md")) continue;
    const archivo = await (h as FileSystemFileHandle).getFile();
    out.push({ nombre: h.name, texto: await archivo.text() });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function leerArchivo(carpeta: Carpeta, nombre: string): Promise<string | null> {
  try {
    const h = await carpeta.getFileHandle(nombre);
    return await (await h.getFile()).text();
  } catch {
    return null;
  }
}

export async function escribirArchivo(carpeta: Carpeta, nombre: string, texto: string) {
  const h = await carpeta.getFileHandle(nombre);
  const w = await h.createWritable();
  await w.write(texto);
  await w.close();
}

export const borrarArchivo = (carpeta: Carpeta, nombre: string) => carpeta.removeEntry(nombre);

/** Da el texto como descarga: lo que queda, en los navegadores sin acceso a carpetas. */
export function descargar(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
