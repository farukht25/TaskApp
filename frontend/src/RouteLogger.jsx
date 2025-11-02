import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { log } from "./utils/logger";

export default function RouteLogger() {
  const location = useLocation();
  useEffect(() => {
    log("route_change", { path: location.pathname + location.search });
  }, [location]);
  return null;
}

