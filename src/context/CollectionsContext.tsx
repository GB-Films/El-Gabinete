import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "../services/firebase";
import type { CuratedCollection } from "../types";

export const COLLECTIONS_CONFIG_PRODUCT_ID = "_collections_config";

interface CollectionsContextValue {
  collections: CuratedCollection[];
  publishedCollections: CuratedCollection[];
  loadingCollections: boolean;
  collectionsConfigured: boolean;
  collectionsError: string;
}

const CollectionsContext = createContext<CollectionsContextValue | undefined>(undefined);

function normalizeCollection(id: string, data: Partial<CuratedCollection>): CuratedCollection {
  const productIds = Array.isArray(data.productIds)
    ? Array.from(new Set(data.productIds.filter((value): value is string => typeof value === "string" && value.length > 0)))
    : [];

  return {
    id,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Colección sin nombre",
    description: typeof data.description === "string" ? data.description.trim() : "",
    productIds,
    coverProductId:
      typeof data.coverProductId === "string" && productIds.includes(data.coverProductId)
        ? data.coverProductId
        : productIds[0] ?? "",
    published: data.published !== false,
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function CollectionsProvider({ children }: PropsWithChildren) {
  const [collections, setCollections] = useState<CuratedCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [collectionsConfigured, setCollectionsConfigured] = useState(false);
  const [collectionsError, setCollectionsError] = useState("");

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setLoadingCollections(false);
      setCollectionsError("No se pudieron cargar las colecciones.");
      return;
    }

    return onSnapshot(
      doc(db, "products", COLLECTIONS_CONFIG_PRODUCT_ID),
      (snapshot) => {
        setCollectionsConfigured(snapshot.exists());
        const storedCollections = snapshot.exists() && Array.isArray(snapshot.data().collections)
          ? snapshot.data().collections as Partial<CuratedCollection>[]
          : [];
        setCollections(
          storedCollections
            .map((item) => normalizeCollection(typeof item.id === "string" ? item.id : "", item))
            .filter((item) => item.id.length > 0)
            .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
        );
        setCollectionsError("");
        setLoadingCollections(false);
      },
      (error) => {
        console.error(error);
        setCollectionsError("No pudimos cargar las colecciones.");
        setLoadingCollections(false);
      },
    );
  }, []);

  const publishedCollections = useMemo(
    () => collections.filter((item) => item.published && item.productIds.length > 0),
    [collections],
  );

  const value = useMemo(
    () => ({ collections, publishedCollections, loadingCollections, collectionsConfigured, collectionsError }),
    [collections, publishedCollections, loadingCollections, collectionsConfigured, collectionsError],
  );

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
}

export function useCollections() {
  const context = useContext(CollectionsContext);
  if (!context) throw new Error("useCollections debe usarse dentro de CollectionsProvider");
  return context;
}
