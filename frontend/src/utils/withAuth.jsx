import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { isSignedIn } from "../lib/tokenStorage";

const withAuth = (WrappedComponent) => {
    const AuthComponent = (props) => {
        const navigate = useNavigate();

        useEffect(() => {
            if (!isSignedIn()) {
                navigate("/auth", { replace: true });
            }
        }, [navigate]);

        // Render nothing while redirecting, so a protected page never flashes
        // on screen for a signed-out visitor.
        if (!isSignedIn()) return null;

        return <WrappedComponent {...props} />;
    };

    return AuthComponent;
};

export default withAuth;
