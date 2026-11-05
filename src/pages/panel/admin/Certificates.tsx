import { Navigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { SERVER_URL } from "../../../components/Includes";

import StudentCertificates from "../student/StudentCertificates";

/* /panel/certificates
   Students: their certificates (StudentCertificates).
   Admins: the admin certificates page is Certificate Requests
   (CertificateRequests.tsx) — this URL sends them there, so old links and the
   certificate page's "back" button keep working. */
export default function Certificates() {
  const [usertype, setusertype] = useState("");

  const getCookie = (name: string): string | null => {
    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      const [key, ...value] = cookie.split("=");
      if (key === name) return decodeURIComponent(value.join("="));
    }
    return null;
  };

  useEffect(() => {
    const status = getCookie("id");
    setusertype(status === "X" || status === "Y" ? "Admin" : "Student");

    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn) {
          setusertype(res.data.id === "X" || res.data.id === "Y" ? "Admin" : "Student");
        }
      })
      .catch(() => {});
  }, []);

  if (usertype === "Admin") return <Navigate to="/panel/certificate-requests" replace />;
  if (usertype === "Student") return <StudentCertificates />;
  return null;
}
