export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{fontSize:"48px", fontWeight:"bold"}}>
        TaxBook AI
      </h1>

      <p style={{marginTop:"20px", fontSize:"20px"}}>
        AI Accounting for Nigerian Businesses
      </p>

      <div style={{marginTop:"40px", display:"flex", gap:"20px"}}>
        <a href="/signup">
          <button style={{
            padding:"12px 24px",
            background:"#000",
            color:"#fff",
            borderRadius:"8px"
          }}>
            Start Free
          </button>
        </a>

        <a href="/login">
          <button style={{
            padding:"12px 24px",
            border:"1px solid #000",
            borderRadius:"8px"
          }}>
            Login
          </button>
        </a>
      </div>
    </main>
  )
}