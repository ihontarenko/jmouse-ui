import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from "react"

/**
 * The properties a product's router link receives from the kit: where it goes, its class, its current state, its
 * content. TanStack Router's `Link`, React Router's `Link` and a plain anchor all take these.
 */
export interface LinkComponentProperties extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string
  children?: ReactNode
}

/** Where the reader is: what a tab strip or a rail compares its destinations against. */
export interface CurrentLocation {
  pathname: string
  search: string
}

interface RouterBridge {
  component: ComponentType<LinkComponentProperties> | null
  useLocation: () => CurrentLocation
  navigate: ((to: string) => void) | null
}

function useWindowLocation(): CurrentLocation {
  const [location, setLocation] = useState<CurrentLocation>(() => ({ pathname: window.location.pathname, search: window.location.search }))
  useEffect(() => {
    const follow = () => setLocation({ pathname: window.location.pathname, search: window.location.search })
    window.addEventListener("popstate", follow)
    return () => window.removeEventListener("popstate", follow)
  }, [])
  return location
}

const RouterContext = createContext<RouterBridge>({ component: null, useLocation: useWindowLocation, navigate: null })

export interface LinkProviderProperties {
  /** The product's router link — `Link` from react-router-dom or TanStack Router. */
  component: ComponentType<LinkComponentProperties>
  /** The router's own location hook (`useLocation`), so a tab strip knows which tab is open. */
  useLocation?: () => CurrentLocation
  /** The router's navigate function, for a menu item that goes somewhere. */
  navigate?: (to: string) => void
  children: ReactNode
}

/**
 * Hands the product's router to every kit component that navigates — crumbs, tabs, rail items, menu items, buttons with
 * `to` — so they take `to="/parts"` and move without a page load, and know where the reader is. Mount it once, inside
 * the router. Without it a kit link is a plain anchor and the location is the window's: still correct, with a full load.
 *
 * ⚠️ `useLocation` is called as a hook inside kit components, so pass the router's hook itself and never a function
 * that changes between renders.
 */
export function LinkProvider({ component, useLocation = useWindowLocation, navigate, children }: LinkProviderProperties) {
  return <RouterContext.Provider value={{ component, useLocation, navigate: navigate ?? null }}>{children}</RouterContext.Provider>
}

/** A link through the product's router when one was provided, a plain anchor otherwise. */
export function KitLink({ to, children, ...rest }: LinkComponentProperties) {
  const { component: RouterLink } = useContext(RouterContext)
  if (RouterLink) {
    return <RouterLink to={to} {...rest}>{children}</RouterLink>
  }
  return <a href={to} {...rest}>{children}</a>
}

/** The reader's location, from the product's router when it gave one. */
export function useKitLocation(): CurrentLocation {
  const { useLocation } = useContext(RouterContext)
  return useLocation()
}

/** Navigates through the product's router, or by assigning the address when there is none. */
export function useKitNavigate(): (to: string) => void {
  const { navigate } = useContext(RouterContext)
  return navigate ?? ((to: string) => window.location.assign(to))
}
