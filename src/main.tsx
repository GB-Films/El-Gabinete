import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AvailabilityProvider } from "./context/AvailabilityContext";
import { CatalogProvider } from "./context/CatalogContext";
import { CollectionsProvider } from "./context/CollectionsContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { SelectionProvider } from "./context/SelectionContext";
import "./styles/index.css";
import "./styles/refinement.css";
import "./styles/brand-restyle.css";
import "./styles/minimal-system.css";
import "./styles/hero-layout.css";
import "./styles/interaction-motion.css";
import "./styles/totem-uses.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <CatalogProvider>
        <CollectionsProvider>
          <AvailabilityProvider>
            <FavoritesProvider>
              <SelectionProvider>
                <App />
              </SelectionProvider>
            </FavoritesProvider>
          </AvailabilityProvider>
        </CollectionsProvider>
      </CatalogProvider>
    </AuthProvider>
  </React.StrictMode>,
);
