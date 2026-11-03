// Se carga con `node --import`: activa resolver.mjs antes de ejecutar el script.
import { register } from "node:module";
register("./resolver.mjs", import.meta.url);
