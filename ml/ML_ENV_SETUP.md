## Deep Learning Environment Setup (Windows, Python 3.10 + TensorFlow)

This guide creates a dedicated Python 3.10 environment for TensorFlow-based Deep Learning experiments, separate from your existing `.venv` used for classical ML.

### 1) Install Python 3.10 on Windows
- Download and install Python 3.10 from the official Python website.
- During installation, check “Add Python to PATH”.

### 2) Create a new virtual environment `tfenv` (inside `ml/`)
From the repository root:
```
cd motion-edu-app\ml
python3.10 -m venv tfenv
```

If `python3.10` is not recognized, try `py -3.10 -m venv tfenv` or provide the full path to your Python 3.10 executable.

### 3) Activate `tfenv` on Windows
```
tfenv\Scripts\activate
```
Your prompt should show `(tfenv)` once activated.

### 4) Install required packages (CPU-based)
Upgrade pip and install the core packages:
```
pip install --upgrade pip
pip install tensorflow scikit-learn pandas numpy matplotlib jupyter
```
(Alternatively, you can use `pip install -r requirements_tf.txt` from the `ml/` folder.)

### 5) Usage guidance
- The existing `.venv` is used for classical ML (RandomForest, LogisticRegression, etc.).
- The new `tfenv` is used only for Deep Learning (TensorFlow) experiments.
- Run notebooks for Deep Learning with `tfenv` activated.
- TensorFlow does not officially support Python 3.11 on Windows; hence the dedicated Python 3.10 environment.

### 6) Launch Jupyter with `tfenv`
From the `ml/` directory:
```
tfenv\Scripts\activate
jupyter notebook
```


