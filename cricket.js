function startCricketGame(canvas, onFinish) {
  const ctx = canvas.getContext("2d");
  let animationId = null;
  let completed = false;

  // Game variables
  let ballX = 20;
  const ballY = canvas.height / 2;
  let speed = 4.5;
  let gameStarted = true;

  // Bat position
  const batX = canvas.width - 45;
  const batWidth = 10;
  const batHeight = 70;

  function drawBat() {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(batX, ballY - batHeight / 2, batWidth, batHeight);
    ctx.fillStyle = "#A0522D";
    ctx.fillRect(batX - 3, ballY - batHeight / 2 + 10, 5, batHeight - 20);
  }

  function drawBall() {
    ctx.beginPath();
    ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);

    // Gradient for 3D effect
    const gradient = ctx.createLinearGradient(ballX - 5, ballY - 5, ballX + 5, ballY + 5);
    gradient.addColorStop(0, "#E53935");
    gradient.addColorStop(1, "#B71C1C");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Stitching effect
    ctx.beginPath();
    ctx.arc(ballX, ballY, 10, 0.3, 0.7);
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawPitch() {
    // Grass
    ctx.fillStyle = "#2E7D32";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pitch lines
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(batX - 15, 0);
    ctx.lineTo(batX - 15, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(batX - 25, 0);
    ctx.lineTo(batX - 25, canvas.height);
    ctx.stroke();
  }

  function finish(message, isSuccess) {
    if (completed) return;
    completed = true;

    if (animationId) cancelAnimationFrame(animationId);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPitch();

    ctx.font = "bold 24px Arial";
    ctx.fillStyle = isSuccess ? "#4CAF50" : "#F44336";
    ctx.shadowBlur = 0;
    ctx.fillText(message, canvas.width / 2 - 80, canvas.height / 2);

    if (isSuccess) {
      ctx.font = "16px Arial";
      ctx.fillStyle = "#666";
      ctx.fillText("+ Focus restored!", canvas.width / 2 - 70, canvas.height / 2 + 40);
    }

    setTimeout(() => {
      if (onFinish) onFinish();
    }, 1500);
  }

  function gameLoop() {
    if (completed) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPitch();
    drawBat();
    drawBall();

    ballX += speed;

    // Check if ball passed the bat
    if (ballX > batX + 10) {
      finish("Missed!", false);
      return;
    }

    animationId = requestAnimationFrame(gameLoop);
  }

  function handleClick(e) {
    if (completed) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const clickX = (e.clientX - rect.left) * scaleX;

    // Check if click is in bat area
    if (clickX >= batX - 15 && clickX <= batX + batWidth + 15) {
      // Timing-based scoring
      const distanceToBat = batX - ballX;
      if (distanceToBat < 30 && distanceToBat > -10) {
        finish("🏏 SIX! Great timing!", true);
      } else if (distanceToBat < 50) {
        finish("👍 Good shot!", true);
      } else {
        finish("⏰ Too early!", false);
      }
    }
  }

  canvas.addEventListener("click", handleClick);
  gameLoop();

  // Return cleanup function
  return () => {
    if (animationId) cancelAnimationFrame(animationId);
    canvas.removeEventListener("click", handleClick);
  };
}

window.startCricketGame = startCricketGame;