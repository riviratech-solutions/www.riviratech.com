import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import { SERVER_URL } from "../../components/Includes";
import { clearCachedUser } from "../../utils/currentUser";

/**
 * /logout — clears the server session + auth cookies, then sends the user to
 * the sign-in page. Panel pages navigate here (via initchecklogin) when the
 * check-login call reports the visitor isn't logged in or lacks the right role.
 */
export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {

    const logout = async () => {
      try {
        await axios.post(
          SERVER_URL + "api/logout",
          {},
          { withCredentials: true }
        );
      } finally {
        clearCachedUser();
        ["key", "token", "aut", "cross", "id"].forEach(cookie =>
          Cookies.remove(cookie, { path: "/" })
        );

        navigate("/signin", { replace: true });
      }
    };

    logout();


  }, [navigate]);

  return null;
}
