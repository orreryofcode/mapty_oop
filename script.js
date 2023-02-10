"use strict";
class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in kn
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/mi
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

/////////////////////////////////////////
//APPLICATION CLASS ARCHITECTURE
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    //Get current position
    this._getPosition();

    //Get data from local storage
    this._getLocalStorage();

    //Add Event listeners to form and to workout type field
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    containerWorkouts.addEventListener("click", this._moveToMarker.bind(this));
  }

  // Get user position using the _loadMap method and handle errors   *
  _getPosition() {
    const error = Toastify({
      text: "Unable to retrieve your location.",
      duration: 3000,
      close: true,
      gravity: "top",
      position: "left",
      offset: {
        x: "50vw",
        y: 10,
      },
      className: "toastify-notification",
    });

    if (!navigator.geolocation) {
      error.showToast();
    } else {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
        error.showToast();
      });
    }
  }

  //Get user position and draw map with a marker
  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    // Create an array that stores the user's coordinates
    const coordinates = [latitude, longitude];
    //Create Map of user location and display marker on current position using LeafletJS
    this.#map = L.map("map").setView(coordinates, this.#mapZoomLevel);
    //Create marker on user location
    const marker = L.marker(coordinates).addTo(this.#map);
    //Create popup
    marker.bindPopup("<p>This is a sample popup!</p>").openPopup();
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.#map);

    //Add new marker on clicked location
    this.#map.on("click", this._showForm.bind(this));

    //Render workout markers
    this.#workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
    });
  }

  //Render form when user clicks on location on map
  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";

    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => {
      form.style.display = "grid";
    }, 1000);
  }

  //Toggle elevation/cadence based on workout type
  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  //Create a new workout
  _newWorkout(e) {
    e.preventDefault();

    const inputError = Toastify({
      text: "Inputs have to be positive values",
      duration: 3000,
      close: true,
      gravity: "top",
      position: "left",
      offset: {
        x: "50vw",
        y: 10,
      },
      className: "toastify-notification",
    });

    // Check all inputs are numbers
    const validInputs = (...inputs) =>
      inputs.every((input) => Number.isFinite(input));

    // Check all inputs are positive EXCEPT for elevation
    const allPositive = (...inputs) => inputs.every((input) => input > 0);

    //Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running, create Running object
    if (type === "running") {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        inputError.showToast();
        return;
      }
      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // If workout is cycling, create Cycling object
    if (type === "cycling") {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        inputError.showToast();
        return;
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkout(workout);

    // Render workout in list
    this._renderWorkoutMarker(workout);

    // Hide form & clear inputs
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  // Render workout markers
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  // Render new workouts to sidebar list
  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    if (workout.type === "running") {
      html += `
        <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;
    }

    if (workout.type === "cycling") {
      html += `
        <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    </li
        `;
    }
    form.insertAdjacentHTML("afterend", html);
  }

  // Move view to marker based on which workout the user clicked in the sidebar
  _moveToMarker(e) {
    const workoutEl = e.target.closest(".workout");

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using public interface
    // workout.click(); <-- This method will not work on objects loaded from local storage because those objects lose their prototype chain when saved
  }

  _setLocalStorage() {
    localStorage.setItem("Workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("Workouts"));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach((work) => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem("Workouts");
    location.reload();
  }
}

const app = new App();

/**
 * Ideas to implement
 * 1. Edit a workout
 * 2. Delete a single workout
 * 3. Sort workout by a field
 * 4. Re-build the objects when loaded from local storage
 * 5. Create better error and confirmation messages
 *
 * 6. Position the map to show all workouts
 * 7. Draw lines and shapes instead of points
 * 8. Geocode location from the coordinates (ie: plug in the coordinates to get back the real location)
 * 9. Display Weather
 *
 *  */
