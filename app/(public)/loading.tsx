/** Skeleton temático compartido para el grupo público (§3.2). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="mb-8 h-10 w-48 rounded-xl skeleton" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-2xl skeleton" />
        ))}
      </div>
    </div>
  );
}
