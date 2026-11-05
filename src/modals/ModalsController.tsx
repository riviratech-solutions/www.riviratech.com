import { useEffect, useState } from "react";

import TermsConsentModal from './TermsConsentModal'
import DecideCareerModal from "./DecideCareerModal";


const ModalsController: React.FC = () => {

  const [currentModal, setCurrentModal] = useState(0);

  useEffect(() => {


  }, []);

  return (<>
    {
      currentModal === 0 && (
        <TermsConsentModal
          onClose={() => setCurrentModal(1)}
        />
      )
    }

    {
      currentModal === 1 && (
        <DecideCareerModal
          onClose={() => setCurrentModal(2)}
        />
      )
    }

  </>);
};

export default ModalsController;
