import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./assets/global.css"; // Ensure styles are imported

export default function App() {
  return <RouterProvider router={router} />;
}
