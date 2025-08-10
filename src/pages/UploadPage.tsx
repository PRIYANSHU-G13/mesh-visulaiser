import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Container,
  FormControl,
  FormHelperText,
  FormLabel,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { keyframes } from "@emotion/react";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { CaseJSON } from "../types";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import STLObject from "../components/STLObject";


const bgShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

export default function UploadPage() {
  const nav = useNavigate();
  const [meshAFile, setMeshAFile] = useState<File | null>(null);
  const [meshBFile, setMeshBFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [meshAUrl, setMeshAUrl] = useState<string>('');
  const [meshBUrl, setMeshBUrl] = useState<string>('');


  useEffect(() => {
    if (!meshAFile) return;
    const url = URL.createObjectURL(meshAFile);
    setMeshAUrl(url);
  }, [meshAFile])

  useEffect(() => {
    if (!meshBFile) return;
    const url = URL.createObjectURL(meshBFile);
    setMeshBUrl(url);
  }, [meshBFile])

  const handleSubmit = async () => {
    if (!meshAFile || !meshBFile || !jsonFile) {
      alert("Please upload two STL files and one JSON file.");
      return;
    }

    const meshAUrl = URL.createObjectURL(meshAFile);
    const meshBUrl = URL.createObjectURL(meshBFile);

    const jsonText = await jsonFile.text();
    let jsonData: CaseJSON;
    try {
      jsonData = JSON.parse(jsonText) as CaseJSON;
    } catch {
      alert("Invalid JSON file.");
      return;
    }

    nav("/viewer", { state: { meshAUrl, meshBUrl, jsonData } });
  };

  const isValid = Boolean(meshAFile && meshBFile && jsonFile);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        // Subtle animated gradient background
        background:
          "linear-gradient(120deg, #c0d7ffff, #c2ffd7ff, #fbd0e5ff)",
        animation: `${bgShift} 18s ease infinite`,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={8}
          sx={{
            mx: "auto",
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            bgcolor: "background.paper",
            backdropFilter: "blur(6px)",
          }}
        >
          <Typography
            variant="h4"
            fontWeight={700}
            align="center"
            gutterBottom
            sx={{ color: "primary.main" }}
          >
            DentalAI
          </Typography>
          <Typography
            variant="subtitle1"
            align="center"
            gutterBottom
            sx={{ color: "text.secondary", mb: 3 }}
          >
            Frontend Assignment
          </Typography>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Upload Meshes & JSON
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please upload <strong>two STL files</strong> and <strong>one JSON file</strong>. Fields marked with <span style={{ color: "#d32f2f" }}>*</span> are required.
          </Typography>

          {/* <Stack spacing={3}> */}
            <div style={{ display: "flex", gap: 16,  marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 30, flexWrap: "wrap" , minWidth: 300 , flexDirection: "column"}}>
                {/* STL A */}
                <FormControl>
                  <FormLabel required>STL A</FormLabel>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
                    <Button
                      variant="outlined"
                      startIcon={<UploadFileIcon />}
                      component="label"
                    >
                      Choose file
                      <input
                        hidden
                        type="file"
                        accept=".stl"
                        onChange={(e) => setMeshAFile(e.target.files?.[0] || null)}
                      />
                    </Button>

                    {meshAFile ? (
                      <Chip
                        label={meshAFile.name}
                        onDelete={() => setMeshAFile(null)}
                        variant="outlined"
                      />
                    ) : (
                      <FormHelperText>Select an .stl file</FormHelperText>
                    )}
                  </Stack>
                </FormControl>

                {/* STL B */}
                <FormControl>
                  <FormLabel required>STL B</FormLabel>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
                    <Button
                      variant="outlined"
                      startIcon={<UploadFileIcon />}
                      component="label"
                    >
                      Choose file
                      <input
                        hidden
                        type="file"
                        accept=".stl"
                        onChange={(e) => setMeshBFile(e.target.files?.[0] || null)}
                      />
                    </Button>

                    {meshBFile ? (
                      <Chip
                        label={meshBFile.name}
                        onDelete={() => setMeshBFile(null)}
                        variant="outlined"
                      />
                    ) : (
                      <FormHelperText>Select an .stl file</FormHelperText>
                    )}
                  </Stack>
                </FormControl>

                {/* JSON */}
                <FormControl>
                  <FormLabel required>Annotations JSON</FormLabel>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
                    <Button
                      variant="outlined"
                      startIcon={<UploadFileIcon />}
                      component="label"
                    >
                      Choose file
                      <input
                        hidden
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
                      />
                    </Button>

                    {jsonFile ? (
                      <Chip
                        label={jsonFile.name}
                        onDelete={() => setJsonFile(null)}
                        variant="outlined"
                      />
                    ) : (
                      <FormHelperText>Select a .json file</FormHelperText>
                    )}
                  </Stack>
                </FormControl>
              </div>
                <div style={{ border : '1px dashed #ccc', padding: 16, borderRadius: 8, width: '100%', height : '35vh'}}>
                <p style={{margin : 0}}>
                  STL Previewer
                </p>
                <div style={{ height: '100%' }}>
                        <Canvas camera={{ position: [3, 3, 5], fov: 50 }} shadows>
                          <ambientLight intensity={0.7} />
                          <directionalLight position={[15, 20, 15]} intensity={1} castShadow />
                          <OrbitControls/>
                          <Environment preset="city" />
                                
                          {meshAUrl && <group position={[0,0,0]}>
                            <STLObject
                                url={meshAUrl}
                                color="#eef155"
                            />
                            </group>}
                
                            {meshBUrl && <group position={[0,0,0]}>
                            <STLObject
                                url={meshBUrl}
                                color="#afd7f9"
                            />
                            </group>}
                        </Canvas>
                </div>
              </div>
            </div>

            <Stack direction="row" justifyContent="flex-end" spacing={1.5} mt={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  setMeshAFile(null);
                  setMeshBFile(null);
                  setJsonFile(null);
                }}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={!isValid}
              >
                Submit
              </Button>
            </Stack>

            {!isValid && (
              <FormHelperText sx={{ color: "error.main", textAlign: "right" }}>
                All three files are required to continue.
              </FormHelperText>
            )}
          {/* </Stack> */}
        </Paper>
      </Container>

    </Box>
  );
}


// CAMERA, KNN, GEOMETRY, RECASTING
