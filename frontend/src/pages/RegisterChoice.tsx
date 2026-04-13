import { Link } from "react-router-dom";

export default function RegisterChoice() {
    return (
        <div className="auth-page">
            <div className="auth-card" style={{ maxWidth: 420, textAlign: "center" }}>
                <h1>Create an account</h1>
                <p style={{ marginBottom: 24, color: "#666" }}>
                    How would you like to use the platform?
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Link to="/register/user" className="btn btn-primary btn-full"
                        style={{ textDecoration: "none", textAlign: "center" }}>
                        Register as a User
                    </Link>
                    <Link to="/register/business" className="btn btn-full"
                        style={{
                            textDecoration: "none", textAlign: "center",
                            border: "1px solid #ccc", background: "#fff", color: "#333"
                        }}>
                        Register as a Business
                    </Link>
                </div>

                <div className="auth-links" style={{ marginTop: 20 }}>
                    <span>Already have an account? <Link to="/login">Sign in</Link></span>
                </div>
            </div>
        </div>
    );
}
