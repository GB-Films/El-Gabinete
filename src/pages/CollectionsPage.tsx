import { ArrowRight, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import { ObjectImage } from "../components/ObjectImage";
import { useCatalog } from "../context/CatalogContext";
import { useCollections } from "../context/CollectionsContext";

export function CollectionsPage() {
  const { products, categories, loading } = useCatalog();
  const { publishedCollections, loadingCollections } = useCollections();
  const groups = categories
    .map((category) => {
      const categoryProducts = products.filter((product) => product.category === category);
      return {
        category,
        products: categoryProducts,
        imageProduct: categoryProducts.find((product) => product.images.length > 0) ?? categoryProducts[0],
      };
    })
    .filter((group) => group.products.length > 0);

  return (
    <div className="collections-page-mobile mx-auto w-full max-w-[1520px] px-4 py-10 sm:px-8 lg:px-12">
      <section className="collections-hero simple-page-hero">
        <p className="eyebrow">Explorar</p>
        <h1 className="mt-3 max-w-[780px] font-display text-[clamp(2.4rem,4.6vw,4.6rem)] font-medium uppercase leading-[0.96] tracking-[0.02em] text-gabinete-darkBrown">
          Encontrá por categoría.
        </h1>
        <p className="mt-5 max-w-[700px] font-editorial text-base leading-7 text-gabinete-muted">
          Una forma simple de recorrer el archivo cuando todavía no tenés un objeto exacto en mente.
        </p>
      </section>

      {!loadingCollections && publishedCollections.length > 0 && (
        <section className="curated-collections-section" aria-labelledby="curated-collections-title">
          <div className="collections-section-heading">
            <div>
              <p className="eyebrow"><Layers3 size={15} /> Selección curada</p>
              <h2 id="curated-collections-title">Colecciones para construir una escena.</h2>
            </div>
            <p>Grupos de objetos elegidos para funcionar juntos por clima, época o intención visual.</p>
          </div>
          <div className="curated-collection-grid">
            {publishedCollections.map((item) => {
              const collectionProducts = item.productIds
                .map((id) => products.find((product) => product.id === id))
                .filter((product) => product !== undefined);
              const coverProduct = products.find((product) => product.id === item.coverProductId)
                ?? collectionProducts[0];

              return (
                <Link
                  key={item.id}
                  to={`/catalogo?coleccion=${encodeURIComponent(item.id)}`}
                  className="curated-collection-card app-interactive-tile"
                >
                  {coverProduct && <ObjectImage product={coverProduct} compact showLabel={false} />}
                  <div>
                    <span>{collectionProducts.length} {collectionProducts.length === 1 ? "objeto" : "objetos"}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description || "Una selección de piezas del archivo Totem."}</p>
                    <em>Ver colección <ArrowRight className="interactive-tile-arrow" size={15} /></em>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {!loadingCollections && publishedCollections.length === 0 && (
        <>
          <div className="collections-section-heading category-collections-heading">
            <div>
              <p className="eyebrow">Archivo completo</p>
              <h2>Explorá por categoría.</h2>
            </div>
          </div>

          {loading ? (
            <div className="catalog-loading" role="status">Preparando categorías…</div>
          ) : groups.length === 0 ? (
            <div className="catalog-error">
              <strong>Las categorías todavía no están disponibles.</strong>
              <Link to="/catalogo">Ir al catálogo</Link>
            </div>
          ) : (
            <section className="collection-category-grid mt-8 grid">
              {groups.map((group) => (
                <Link
                  key={group.category}
                  to={`/catalogo?categoria=${encodeURIComponent(group.category)}`}
                  className="collection-category-card app-interactive-tile"
                >
                  {group.imageProduct && <ObjectImage product={group.imageProduct} compact />}
                  <div className="collection-category-body">
                    <p className="collection-count">
                      <strong>{group.products.length}</strong>
                      <span>{group.products.length === 1 ? "Pieza disponible" : "Piezas disponibles"}</span>
                    </p>
                    <h2>{group.category}</h2>
                    <span className="collection-category-action">
                      Ver objetos <ArrowRight className="interactive-tile-arrow" size={15} />
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
